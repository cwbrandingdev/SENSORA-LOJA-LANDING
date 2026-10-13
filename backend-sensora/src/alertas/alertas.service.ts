import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LIMIAR_ESTOQUE_BAIXO } from '../dashboard/constants/dashboard.constants';
import { MelhorEnvioService } from '../melhor-envio/melhor-envio.service';
import { StatusEnvio } from '../pedidos/enums/status-envio.enum';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { StatusDevolucao } from '../devolucoes/enums/status-devolucao.enum';
import {
  LIMIAR_DIAS_PEDIDO_SEM_ENVIO,
  LINK_DEVOLUCOES,
  LINK_INTEGRACOES,
  LINK_PEDIDOS,
  LINK_PRODUTOS,
} from './constants/alertas.constants';
import { Alerta } from './entities/alerta.entity';

@Injectable()
export class AlertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly melhorEnvioService: MelhorEnvioService,
  ) {}

  // Vistoria de Alertas Operacionais (Admin) — V1, escopo fechado em 4
  // alertas (ver relatório da vistoria): estoque baixo/esgotado, reembolso
  // solicitado, pedido pago aguardando envio, Melhor Envio desconectado.
  // Todas as 4 verificações rodam em paralelo (Promise.all) e são sempre
  // `count`/leitura pontual — nenhum `findMany` de linha completa, nenhuma
  // chamada externa (Melhor Envio é lido só do banco, via
  // MelhorEnvioService.estaConectado() — nunca GET /api/v2/me aqui, isso é
  // a verificação sob demanda da Central de Integrações, deliberadamente
  // separada desta). Um alerta só entra na resposta quando há algo a tratar
  // (quantidade >= 1) — lista vazia é o estado normal e esperado ("sem
  // alertas no momento"), nunca um erro.
  async obterAlertas(): Promise<Alerta[]> {
    const { dataAte, limiteEnvio } = this.calcularLimiteEnvio();
    const [
      produtosSemEstoque,
      produtosEstoqueBaixo,
      reembolsosSolicitados,
      pedidosAguardandoEnvio,
      melhorEnvioConectado,
      devolucoesAguardandoAnalise,
      pedidosNovos,
    ] = await Promise.all([
      this.prisma.produto.count({
        where: { ativo: true, quantidade: 0 },
      }),
      this.prisma.produto.count({
        where: {
          ativo: true,
          quantidade: { gt: 0, lte: LIMIAR_ESTOQUE_BAIXO },
        },
      }),
      this.prisma.pedido.count({
        where: { status: StatusPedido.REEMBOLSO_SOLICITADO },
      }),
      this.prisma.pedido.count({
        where: {
          status: StatusPedido.PAGO,
          statusEnvio: StatusEnvio.NAO_ENVIADO,
          data: { lt: limiteEnvio },
        },
      }),
      this.melhorEnvioService.estaConectado(),
      // Etapa 7 — devoluções esperando a decisão do Admin. Só SOLICITADA:
      // é o mesmo filtro que o link abre na fila (GET /admin/devolucoes
      // aceita um único status), então a contagem bate com a lista.
      this.prisma.devolucao.count({
        where: { status: StatusDevolucao.SOLICITADA },
      }),
      // Pedidos pagos ainda dentro do prazo de envio — os mais antigos já
      // entram em PEDIDO_AGUARDANDO_ENVIO; nunca o mesmo pedido nos dois.
      this.prisma.pedido.count({
        where: {
          status: StatusPedido.PAGO,
          statusEnvio: StatusEnvio.NAO_ENVIADO,
          data: { gte: limiteEnvio },
        },
      }),
    ]);

    const alertas: Alerta[] = [];

    if (pedidosNovos > 0) {
      alertas.push({
        tipo: 'PEDIDO_NOVO',
        severidade: 'info',
        titulo: 'Novos pedidos pagos para enviar',
        quantidade: pedidosNovos,
        link: `${LINK_PEDIDOS}?status=${StatusPedido.PAGO}`,
      });
    }

    // Estoque baixo/esgotado — um único alerta (mesmo critério já usado no
    // card "Estoque baixo" do Dashboard, ver DashboardService.obterResumo),
    // nunca dois alertas separados para a mesma causa raiz. Severidade
    // `danger` quando há produto REALMENTE esgotado (quantidade 0), senão
    // `warning` (só baixo, ainda vendável).
    const produtosEmAlerta = produtosSemEstoque + produtosEstoqueBaixo;
    if (produtosEmAlerta > 0) {
      alertas.push({
        tipo: 'ESTOQUE_BAIXO',
        severidade: produtosSemEstoque > 0 ? 'danger' : 'warning',
        titulo: 'Produtos com estoque baixo ou esgotado',
        quantidade: produtosEmAlerta,
        link: LINK_PRODUTOS,
      });
    }

    if (reembolsosSolicitados > 0) {
      alertas.push({
        tipo: 'REEMBOLSO_SOLICITADO',
        severidade: 'danger',
        titulo: 'Reembolsos solicitados aguardando confirmação',
        quantidade: reembolsosSolicitados,
        link: `${LINK_PEDIDOS}?status=${StatusPedido.REEMBOLSO_SOLICITADO}`,
      });
    }

    if (pedidosAguardandoEnvio > 0) {
      alertas.push({
        tipo: 'PEDIDO_AGUARDANDO_ENVIO',
        severidade: 'warning',
        titulo: `Pedidos pagos há mais de ${LIMIAR_DIAS_PEDIDO_SEM_ENVIO} dias aguardando envio`,
        quantidade: pedidosAguardandoEnvio,
        // Pedidos pagos até `dataAte` (dia em São Paulo, mesmo critério do
        // filtro da tela de pedidos): o quadro "Para enviar" mostra
        // exatamente os pedidos desta contagem.
        link: `${LINK_PEDIDOS}?status=${StatusPedido.PAGO}&dataAte=${dataAte}`,
      });
    }

    if (devolucoesAguardandoAnalise > 0) {
      alertas.push({
        tipo: 'DEVOLUCAO_SOLICITADA',
        severidade: 'warning',
        titulo: 'Devoluções aguardando análise',
        quantidade: devolucoesAguardandoAnalise,
        link: `${LINK_DEVOLUCOES}?status=${StatusDevolucao.SOLICITADA}`,
      });
    }

    // Alerta booleano (não uma contagem de linhas) — `quantidade: 1`
    // representa "1 problema em aberto", mesmo raciocínio de qualquer
    // alerta desta lista (sempre >= 1 quando presente).
    if (!melhorEnvioConectado) {
      alertas.push({
        tipo: 'MELHOR_ENVIO_DESCONECTADO',
        severidade: 'danger',
        titulo: 'Melhor Envio desconectado — cotação de frete indisponível',
        quantidade: 1,
        link: LINK_INTEGRACOES,
      });
    }

    return alertas;
  }

  // Corte por dia de calendário em São Paulo (o filtro de data da tela de
  // pedidos só trabalha com dias): atrasado = pedido de `dataAte` ou antes,
  // com dataAte = hoje(SP) - LIMIAR_DIAS_PEDIDO_SEM_ENVIO. `limiteEnvio` é o
  // primeiro instante do dia seguinte a dataAte em SP (UTC-3 fixo — o Brasil
  // não tem horário de verão desde 2019).
  private calcularLimiteEnvio(): { dataAte: string; limiteEnvio: Date } {
    const hojeSp = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date());
    const dia = new Date(`${hojeSp}T00:00:00Z`);
    dia.setUTCDate(dia.getUTCDate() - LIMIAR_DIAS_PEDIDO_SEM_ENVIO);
    const dataAte = dia.toISOString().slice(0, 10);
    dia.setUTCDate(dia.getUTCDate() + 1);
    const limiteEnvio = new Date(
      `${dia.toISOString().slice(0, 10)}T00:00:00-03:00`,
    );
    return { dataAte, limiteEnvio };
  }
}
