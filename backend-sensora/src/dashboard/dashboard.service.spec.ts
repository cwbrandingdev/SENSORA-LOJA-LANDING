import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { DashboardService } from './dashboard.service';

// Vistoria do Dashboard operacional (Admin) — testa só
// DashboardService.obterResumo com PrismaService MOCKADO (nenhum banco
// real), mesmo padrão de usuarios.service.spec.ts/pedidos.service.spec.ts:
// cada método Prisma usado pelo service (groupBy/count) é um jest.fn()
// isolado, sem depender de ordem de chamada.
function criarPrismaMock(overrides: {
  pedidoGroupBy?: jest.Mock;
  produtoCount?: jest.Mock;
  categoriaCount?: jest.Mock;
  usuarioCount?: jest.Mock;
}) {
  return {
    pedido: { groupBy: overrides.pedidoGroupBy ?? jest.fn() },
    produto: { count: overrides.produtoCount ?? jest.fn() },
    categoria: { count: overrides.categoriaCount ?? jest.fn() },
    usuario: { count: overrides.usuarioCount ?? jest.fn() },
  };
}

describe('DashboardService — obterResumo', () => {
  // Achado da vistoria: loja sem nenhum pedido/produto/categoria/cliente
  // ainda — groupBy devolve [] (nunca lançado como erro) e todo count
  // devolve 0. O Dashboard precisa continuar funcionando (faturamento R$
  // 0,00, todas as chaves de StatusPedido zeradas), não quebrar.
  it('devolve zeros e as 5 chaves de StatusPedido quando não há nenhum dado', async () => {
    const prisma = criarPrismaMock({
      pedidoGroupBy: jest.fn().mockResolvedValue([]),
      produtoCount: jest.fn().mockResolvedValue(0),
      categoriaCount: jest.fn().mockResolvedValue(0),
      usuarioCount: jest.fn().mockResolvedValue(0),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = module.get(DashboardService);

    const resumo = await service.obterResumo();

    expect(resumo.faturamento).toBe(0);
    expect(resumo.pedidos).toEqual({
      total: 0,
      pagos: 0,
      porStatus: {
        [StatusPedido.PENDENTE]: 0,
        [StatusPedido.PAGO]: 0,
        [StatusPedido.CANCELADO]: 0,
        [StatusPedido.REEMBOLSO_SOLICITADO]: 0,
        [StatusPedido.REEMBOLSADO]: 0,
      },
    });
    expect(resumo.produtos).toEqual({
      total: 0,
      ativos: 0,
      semEstoque: 0,
      estoqueBaixo: 0,
    });
    expect(resumo.categorias).toEqual({ total: 0 });
    expect(resumo.clientes).toEqual({ total: 0, ativos: 0 });
  });

  it('soma faturamento só entre os PAGO e preserva a contagem por status', async () => {
    const pedidoGroupBy = jest.fn().mockResolvedValue([
      { status: StatusPedido.PENDENTE, _count: { _all: 2 }, _sum: { total: 150 } },
      { status: StatusPedido.PAGO, _count: { _all: 3 }, _sum: { total: 299.7 } },
      { status: StatusPedido.CANCELADO, _count: { _all: 1 }, _sum: { total: 50 } },
    ]);
    const prisma = criarPrismaMock({
      pedidoGroupBy,
      produtoCount: jest
        .fn()
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // ativos
        .mockResolvedValueOnce(1) // semEstoque
        .mockResolvedValueOnce(2), // estoqueBaixo
      categoriaCount: jest.fn().mockResolvedValue(4),
      usuarioCount: jest
        .fn()
        .mockResolvedValueOnce(20) // total clientes
        .mockResolvedValueOnce(18), // clientes ativos
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    const service = module.get(DashboardService);

    const resumo = await service.obterResumo();

    // Só PAGO entra no faturamento — PENDENTE/CANCELADO (mesmo com _sum
    // preenchido pelo mock) nunca são somados.
    expect(resumo.faturamento).toBe(299.7);
    expect(resumo.pedidos.total).toBe(6);
    expect(resumo.pedidos.pagos).toBe(3);
    expect(resumo.pedidos.porStatus[StatusPedido.PENDENTE]).toBe(2);
    expect(resumo.pedidos.porStatus[StatusPedido.REEMBOLSADO]).toBe(0);
    expect(resumo.produtos).toEqual({
      total: 10,
      ativos: 8,
      semEstoque: 1,
      estoqueBaixo: 2,
    });
    expect(resumo.categorias).toEqual({ total: 4 });
    expect(resumo.clientes).toEqual({ total: 20, ativos: 18 });
    expect(pedidoGroupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { _all: true },
      _sum: { total: true },
    });
  });
});
