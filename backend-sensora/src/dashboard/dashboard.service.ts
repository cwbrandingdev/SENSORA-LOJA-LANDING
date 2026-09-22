import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { LIMIAR_ESTOQUE_BAIXO } from './constants/dashboard.constants';
import { DashboardResumo } from './entities/dashboard-resumo.entity';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

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
}
