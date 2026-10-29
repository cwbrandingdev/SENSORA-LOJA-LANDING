import { BadRequestException, Injectable } from '@nestjs/common';
import { CheckoutService } from '../checkout/checkout.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { LIMIAR_ESTOQUE_BAIXO } from './constants/dashboard.constants';
import { DashboardResumo } from './entities/dashboard-resumo.entity';
import {
  DashboardResumoMensal,
  ResumoDiaFaturamento,
  ResumoMesPeriodo,
  VariacaoResumoMensal,
} from './entities/dashboard-resumo-mensal.entity';
import {
  diaPedidoSaoPaulo,
  intervaloMesSaoPaulo,
  labelMesSaoPaulo,
  mesAnterior,
  mesAtualSaoPaulo,
  variacaoPercentual,
} from './utils/mes-sao-paulo.util';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkoutService: CheckoutService,
  ) {}

  // Vistoria do Dashboard operacional (Admin) — substitui o padrão anterior
  // (frontend baixando GET /pedidos + /produtos + /categorias inteiros e
  // somando/contando em memória) por agregação no banco: só `count`/
  // `groupBy`, nenhum `findMany` de linha completa. Todas as consultas rodam
  // em paralelo (Promise.all) — nenhuma depende do resultado de outra.
  //
  // Lista vazia é sempre um estado legítimo aqui, nunca tratado como erro
  // (mesmo raciocínio já usado no Dashboard/ClienteDetalhado existentes):
  // `groupBy` sobre uma tabela Pedido vazia devolve `[]`, e o loop abaixo
  // preserva as 5 chaves de StatusPedido zeradas em vez de omiti-las.
  async obterResumo(): Promise<DashboardResumo> {
    // Pix já pago no Asaas (mesmo com saldo bloqueado) entra no faturamento
    // e na contagem de pagos antes de agregar.
    await this.checkoutService.reconciliarPagamentosAsaas();

    const [
      pedidosPorStatus,
      produtosTotal,
      produtosAtivos,
      produtosSemEstoque,
      produtosEstoqueBaixo,
      categoriasTotal,
      clientesTotal,
      clientesAtivos,
    ] = await Promise.all([
      this.prisma.pedido.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.produto.count(),
      this.prisma.produto.count({ where: { ativo: true } }),
      this.prisma.produto.count({
        where: { ativo: true, quantidade: 0 },
      }),
      this.prisma.produto.count({
        where: {
          ativo: true,
          quantidade: { gt: 0, lte: LIMIAR_ESTOQUE_BAIXO },
        },
      }),
      this.prisma.categoria.count(),
      // Clientes reais — Usuario com perfil CLIENTE, nunca o model `Cliente`
      // legado (ver entities/dashboard-resumo.entity.ts). `count()`, nunca
      // `findMany()`: nenhum dado individual de cliente sai por este
      // endpoint.
      this.prisma.usuario.count({
        where: { perfil: PerfilUsuario.CLIENTE },
      }),
      this.prisma.usuario.count({
        where: { perfil: PerfilUsuario.CLIENTE, ativo: true },
      }),
    ]);

    const porStatus = Object.fromEntries(
      Object.values(StatusPedido).map((status) => [status, 0]),
    ) as Record<StatusPedido, number>;

    let pedidosTotal = 0;
    let faturamento = 0;
    for (const grupo of pedidosPorStatus) {
      const status = grupo.status as StatusPedido;
      const quantidade = grupo._count._all;
      porStatus[status] = quantidade;
      pedidosTotal += quantidade;
      if (status === StatusPedido.PAGO) {
        faturamento = Number(grupo._sum.total ?? 0);
      }
    }

    return {
      faturamento,
      pedidos: {
        total: pedidosTotal,
        pagos: porStatus[StatusPedido.PAGO],
        porStatus,
      },
      produtos: {
        total: produtosTotal,
        ativos: produtosAtivos,
        semEstoque: produtosSemEstoque,
        estoqueBaixo: produtosEstoqueBaixo,
      },
      categorias: { total: categoriasTotal },
      clientes: { total: clientesTotal, ativos: clientesAtivos },
    };
  }

  obterResumoMensal(
    ano?: number,
    mes?: number,
    compararAno?: number,
    compararMes?: number,
  ): Promise<DashboardResumoMensal> {
    const atual = mesAtualSaoPaulo();
    const anoRef = ano ?? atual.ano;
    const mesRef = mes ?? atual.mes;
    this.validarMes(anoRef, mesRef);

    let compAno = compararAno;
    let compMes = compararMes;
    if (compAno === undefined || compMes === undefined) {
      const ant = mesAnterior(anoRef, mesRef);
      compAno = ant.ano;
      compMes = ant.mes;
    } else {
      this.validarMes(compAno, compMes);
    }

    return Promise.all([
      this.agregarMes(anoRef, mesRef),
      this.agregarMes(compAno, compMes),
    ]).then(([periodo, comparacao]) => ({
      periodo,
      comparacao,
      variacao: this.calcularVariacao(periodo, comparacao),
    }));
  }

  private validarMes(ano: number, mes: number): void {
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
      throw new BadRequestException('Ano inválido.');
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new BadRequestException('Mês inválido.');
    }
  }

  private calcularVariacao(
    periodo: ResumoMesPeriodo,
    comparacao: ResumoMesPeriodo,
  ): VariacaoResumoMensal {
    return {
      faturamento: variacaoPercentual(
        periodo.faturamento,
        comparacao.faturamento,
      ),
      pedidosPagos: variacaoPercentual(
        periodo.pedidos.pagos,
        comparacao.pedidos.pagos,
      ),
      ticketMedio: variacaoPercentual(periodo.ticketMedio, comparacao.ticketMedio),
    };
  }

  private async agregarMes(ano: number, mes: number): Promise<ResumoMesPeriodo> {
    const { inicio, fim } = intervaloMesSaoPaulo(ano, mes);
    const filtroMes = { data: { gte: inicio, lt: fim } };

    const [
      pedidosPorStatus,
      pedidosPagosDetalhe,
      freteAgg,
      reembolsoAgg,
      topItens,
    ] = await Promise.all([
      this.prisma.pedido.groupBy({
        by: ['status'],
        where: filtroMes,
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.pedido.findMany({
        where: { ...filtroMes, status: StatusPedido.PAGO },
        select: {
          data: true,
          total: true,
          usuarioId: true,
          clienteEmail: true,
        },
      }),
      this.prisma.pedido.aggregate({
        where: { ...filtroMes, status: StatusPedido.PAGO },
        _sum: { freteValor: true },
      }),
      this.prisma.pedido.aggregate({
        where: { ...filtroMes, status: StatusPedido.REEMBOLSADO },
        _sum: { total: true },
      }),
      this.prisma.itemPedido.groupBy({
        by: ['produtoId'],
        where: {
          pedido: { ...filtroMes, status: StatusPedido.PAGO },
        },
        _sum: { quantidade: true, subtotal: true },
        orderBy: { _sum: { subtotal: 'desc' } },
        take: 5,
      }),
    ]);

    const porStatus = Object.fromEntries(
      Object.values(StatusPedido).map((status) => [status, 0]),
    ) as Record<StatusPedido, number>;

    let pedidosTotal = 0;
    let faturamento = 0;
    for (const grupo of pedidosPorStatus) {
      const status = grupo.status as StatusPedido;
      const quantidade = grupo._count._all;
      porStatus[status] = quantidade;
      pedidosTotal += quantidade;
      if (status === StatusPedido.PAGO) {
        faturamento = Number(grupo._sum.total ?? 0);
      }
    }

    const pagos = porStatus[StatusPedido.PAGO];
    const ticketMedio = pagos > 0 ? faturamento / pagos : 0;

    const compradores = new Set<string>();
    for (const pedido of pedidosPagosDetalhe) {
      const chave =
        pedido.usuarioId !== null
          ? `u:${pedido.usuarioId}`
          : `e:${(pedido.clienteEmail ?? '').toLowerCase()}`;
      if (chave !== 'e:') compradores.add(chave);
    }

    const porDiaMap = new Map<string, ResumoDiaFaturamento>();
    for (const pedido of pedidosPagosDetalhe) {
      const dia = diaPedidoSaoPaulo(pedido.data);
      const atual = porDiaMap.get(dia) ?? {
        dia,
        faturamento: 0,
        pedidosPagos: 0,
      };
      atual.faturamento += Number(pedido.total);
      atual.pedidosPagos += 1;
      porDiaMap.set(dia, atual);
    }

    const porDia = [...porDiaMap.values()].sort((a, b) =>
      a.dia.localeCompare(b.dia),
    );

    const produtoIds = topItens.map((item) => item.produtoId);
    const produtos =
      produtoIds.length > 0
        ? await this.prisma.produto.findMany({
            where: { id: { in: produtoIds } },
            select: { id: true, nome: true },
          })
        : [];
    const nomes = new Map(produtos.map((p) => [p.id, p.nome]));

    const topProdutos = topItens.map((item) => ({
      produtoId: item.produtoId,
      nome: nomes.get(item.produtoId) ?? `Produto #${item.produtoId}`,
      quantidade: item._sum.quantidade ?? 0,
      faturamento: Number(item._sum.subtotal ?? 0),
    }));

    return {
      ano,
      mes,
      label: labelMesSaoPaulo(ano, mes),
      faturamento,
      frete: Number(freteAgg._sum.freteValor ?? 0),
      pedidos: {
        total: pedidosTotal,
        pagos,
        porStatus,
      },
      ticketMedio,
      clientesUnicos: compradores.size,
      valorReembolsado: Number(reembolsoAgg._sum.total ?? 0),
      porDia,
      topProdutos,
    };
  }
}
