import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LIMIAR_ESTOQUE_BAIXO } from '../dashboard/constants/dashboard.constants';
import { MelhorEnvioService } from '../melhor-envio/melhor-envio.service';
import { StatusEnvio } from '../pedidos/enums/status-envio.enum';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import {
  LIMIAR_DIAS_PEDIDO_SEM_ENVIO,
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
    const [
      produtosSemEstoque,
      produtosEstoqueBaixo,
      reembolsosSolicitados,
      pedidosAguardandoEnvio,
      melhorEnvioConectado,
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
          data: { lte: this.calcularDataLimiteEnvio() },
        },
      }),
      this.melhorEnvioService.estaConectado(),
    ]);

    const alertas: Alerta[] = [];

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
        link: LINK_PEDIDOS,
      });
    }

    if (pedidosAguardandoEnvio > 0) {
      alertas.push({
        tipo: 'PEDIDO_AGUARDANDO_ENVIO',
        severidade: 'warning',
        titulo: `Pedidos pagos há mais de ${LIMIAR_DIAS_PEDIDO_SEM_ENVIO} dias aguardando envio`,
        quantidade: pedidosAguardandoEnvio,
        link: LINK_PEDIDOS,
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

  private calcularDataLimiteEnvio(): Date {
    const limite = new Date();
    limite.setDate(limite.getDate() - LIMIAR_DIAS_PEDIDO_SEM_ENVIO);
    return limite;
  }
}
