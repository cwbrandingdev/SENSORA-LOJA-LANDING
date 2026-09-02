import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AsaasErroHttpError,
  AsaasIndisponivelError,
  AsaasRefund,
  AsaasService,
} from '../asaas/asaas.service';
import { ItensPedidoService } from '../itens-pedido/itens-pedido.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../produtos/produtos.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { StatusPedido } from './enums/status-pedido.enum';
import { PedidosService } from './pedidos.service';

// Etapa 5B.4 — testa só a regra de negócio de PedidosService.solicitarReembolso
// com Prisma e AsaasService MOCKADOS (nenhuma chamada real ao Asaas, nenhum
// banco real). O "banco" é um objeto em memória (`pedidoFake`) para que o
// mock de `updateMany` consiga refletir corretamente o WHERE condicional
// (claim atômico) — mesmo padrão já usado em checkout.service.spec.ts.

const CLIENTE = {
  id: 1,
  email: 'cliente@sensora.dev',
  perfil: PerfilUsuario.CLIENTE,
};
const OUTRO_CLIENTE = {
  id: 2,
  email: 'outro@sensora.dev',
  perfil: PerfilUsuario.CLIENTE,
};

function refund(overrides: Partial<AsaasRefund> = {}): AsaasRefund {
  return {
    id: 'ref_123',
    status: 'PENDING',
    value: 39.9,
    ...overrides,
  };
}

describe('PedidosService — solicitarReembolso (Etapa 5B.4)', () => {
  let service: PedidosService;
  let asaasService: {
    resolverPaymentIdPorCheckout: jest.Mock;
    consultarEstornos: jest.Mock;
    estornarPagamento: jest.Mock;
  };
  let prisma: {
    pedido: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let pedidoFake: {
    id: number;
    usuarioId: number;
    status: StatusPedido;
    asaasCheckoutId: string | null;
    asaasPaymentId: string | null;
    numero: string;
    data: Date;
    total: number;
  };

  beforeEach(async () => {
    pedidoFake = {
      id: 1,
      usuarioId: CLIENTE.id,
      status: StatusPedido.PAGO,
      asaasCheckoutId: 'chk_123',
      asaasPaymentId: null,
      numero: 'PED-1',
      data: new Date('2026-09-01'),
      total: 39.9,
    };

    prisma = {
      pedido: {
        findUnique: jest.fn(() => ({ ...pedidoFake })),
        findUniqueOrThrow: jest.fn(() => ({ ...pedidoFake })),
        // Simula o comportamento real do updateMany condicional do Postgres:
        // só aplica a mudança (e retorna count:1) se o `status` atual da
        // linha bater com o do WHERE — é isso que torna o claim atômico
        // testável para o cenário de concorrência (item N).
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: { status: StatusPedido; usuarioId?: number };
            data: { status: StatusPedido };
          }) => {
            const ownerOk =
              where.usuarioId === undefined ||
              where.usuarioId === pedidoFake.usuarioId;
            if (ownerOk && where.status === pedidoFake.status) {
              pedidoFake.status = data.status;
              return { count: 1 };
            }
            return { count: 0 };
          },
        ),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(pedidoFake, data);
          return { ...pedidoFake };
        }),
      },
    };

    asaasService = {
      resolverPaymentIdPorCheckout: jest.fn(),
      consultarEstornos: jest.fn(() => []),
      estornarPagamento: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosService,
        { provide: PrismaService, useValue: prisma },
        { provide: ItensPedidoService, useValue: {} },
        { provide: ProdutosService, useValue: {} },
        { provide: AsaasService, useValue: asaasService },
      ],
    }).compile();

    service = module.get(PedidosService);
  });

  // A — PAGO válido: inicia o fluxo (paymentId já existente, sem refund
  // prévio) e chama exatamente um POST /refund.
  it('A: pedido PAGO do dono autenticado inicia o fluxo e chama o Asaas', async () => {
    pedidoFake.asaasPaymentId = 'pay_123';
    asaasService.estornarPagamento.mockResolvedValueOnce(
      refund({ status: 'PENDING' }),
    );

    const resultado = await service.solicitarReembolso(1, CLIENTE);

    expect(resultado.status).toBe(StatusPedido.REEMBOLSO_SOLICITADO);
    expect(asaasService.estornarPagamento).toHaveBeenCalledWith('pay_123');
  });

  // B — pedido de outro usuário: 404, nunca chama Asaas.
  it('B: pedido de outro usuário retorna 404 e não chama o Asaas', async () => {
    await expect(
      service.solicitarReembolso(1, OUTRO_CLIENTE),
    ).rejects.toThrow(NotFoundException);

    expect(asaasService.resolverPaymentIdPorCheckout).not.toHaveBeenCalled();
    expect(asaasService.consultarEstornos).not.toHaveBeenCalled();
    expect(asaasService.estornarPagamento).not.toHaveBeenCalled();
  });

  // D — PENDENTE: 409, sem chamar Asaas (cancelamento é responsabilidade de
  // `cancelar()`).
  it('D: pedido PENDENTE retorna 409 e não chama o Asaas', async () => {
    pedidoFake.status = StatusPedido.PENDENTE;

    await expect(service.solicitarReembolso(1, CLIENTE)).rejects.toThrow(
      ConflictException,
    );
    expect(asaasService.estornarPagamento).not.toHaveBeenCalled();
  });

  // E — CANCELADO: 409.
  it('E: pedido CANCELADO retorna 409', async () => {
    pedidoFake.status = StatusPedido.CANCELADO;

    await expect(service.solicitarReembolso(1, CLIENTE)).rejects.toThrow(
      ConflictException,
    );
    expect(asaasService.estornarPagamento).not.toHaveBeenCalled();
  });

  // F — já REEMBOLSO_SOLICITADO: idempotente, não dispara segundo refund.
  it('F: pedido já REEMBOLSO_SOLICITADO não dispara novo refund', async () => {
    pedidoFake.status = StatusPedido.REEMBOLSO_SOLICITADO;

    const resultado = await service.solicitarReembolso(1, CLIENTE);

    expect(resultado.status).toBe(StatusPedido.REEMBOLSO_SOLICITADO);
    expect(asaasService.estornarPagamento).not.toHaveBeenCalled();
    expect(asaasService.consultarEstornos).not.toHaveBeenCalled();
  });

  // G — já REEMBOLSADO: idempotente, não dispara segundo refund.
  it('G: pedido já REEMBOLSADO não dispara novo refund', async () => {
    pedidoFake.status = StatusPedido.REEMBOLSADO;

    const resultado = await service.solicitarReembolso(1, CLIENTE);

    expect(resultado.status).toBe(StatusPedido.REEMBOLSADO);
    expect(asaasService.estornarPagamento).not.toHaveBeenCalled();
  });

  // H — asaasPaymentId já existente: usa direto, nunca resolve pelo Checkout.
  it('H: usa pedido.asaasPaymentId existente sem resolver pelo Checkout', async () => {
    pedidoFake.asaasPaymentId = 'pay_existente';
    asaasService.estornarPagamento.mockResolvedValueOnce(refund());

    await service.solicitarReembolso(1, CLIENTE);

    expect(asaasService.resolverPaymentIdPorCheckout).not.toHaveBeenCalled();
    expect(asaasService.consultarEstornos).toHaveBeenCalledWith('pay_existente');
    expect(asaasService.estornarPagamento).toHaveBeenCalledWith('pay_existente');
  });

  // I — asaasPaymentId ausente: resolve pelo asaasCheckoutId e persiste.
  it('I: resolve o Payment pelo asaasCheckoutId e persiste asaasPaymentId', async () => {
    pedidoFake.asaasPaymentId = null;
    pedidoFake.asaasCheckoutId = 'chk_123';
    asaasService.resolverPaymentIdPorCheckout.mockResolvedValueOnce({
      encontrado: true,
      payment: { id: 'pay_resolvido', status: 'CONFIRMED' },
    });
    asaasService.estornarPagamento.mockResolvedValueOnce(refund());

    await service.solicitarReembolso(1, CLIENTE);

    expect(asaasService.resolverPaymentIdPorCheckout).toHaveBeenCalledWith(
      'chk_123',
    );
    expect(prisma.pedido.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { asaasPaymentId: 'pay_resolvido' },
    });
    expect(asaasService.estornarPagamento).toHaveBeenCalledWith('pay_resolvido');
  });

  // J — sem checkout nem payment: não chama Asaas, erro controlado, claim
  // revertido para PAGO (nenhuma chamada HTTP havia sido feita ainda).
  it('J: sem asaasCheckoutId/asaasPaymentId não chama o Asaas e reverte para PAGO', async () => {
    pedidoFake.asaasPaymentId = null;
    pedidoFake.asaasCheckoutId = null;

    await expect(service.solicitarReembolso(1, CLIENTE)).rejects.toThrow(
      UnprocessableEntityException,
    );

    expect(asaasService.resolverPaymentIdPorCheckout).not.toHaveBeenCalled();
    expect(asaasService.consultarEstornos).not.toHaveBeenCalled();
    expect(asaasService.estornarPagamento).not.toHaveBeenCalled();
    expect(pedidoFake.status).toBe(StatusPedido.PAGO);
  });

  // K — refund DONE já existente: não executa novo POST /refund, marca
  // REEMBOLSADO.
  it('K: refund DONE já existente não dispara novo POST /refund', async () => {
    pedidoFake.asaasPaymentId = 'pay_123';
    asaasService.consultarEstornos.mockResolvedValueOnce([
      refund({ id: 'ref_1', status: 'DONE' }),
    ]);

    const resultado = await service.solicitarReembolso(1, CLIENTE);

    expect(asaasService.estornarPagamento).not.toHaveBeenCalled();
    expect(resultado.status).toBe(StatusPedido.REEMBOLSADO);
  });

  // L — refund PENDING já existente: não dispara novo POST /refund, mantém
  // REEMBOLSO_SOLICITADO.
  it('L: refund PENDING já existente não dispara novo POST /refund', async () => {
    pedidoFake.asaasPaymentId = 'pay_123';
    asaasService.consultarEstornos.mockResolvedValueOnce([
      refund({ id: 'ref_1', status: 'PENDING' }),
    ]);

    const resultado = await service.solicitarReembolso(1, CLIENTE);

    expect(asaasService.estornarPagamento).not.toHaveBeenCalled();
    expect(resultado.status).toBe(StatusPedido.REEMBOLSO_SOLICITADO);
  });

  // M — nenhum refund existente: executa exatamente um POST /refund.
  it('M: sem refund existente executa exatamente um POST /refund', async () => {
    pedidoFake.asaasPaymentId = 'pay_123';
    asaasService.consultarEstornos.mockResolvedValueOnce([]);
    asaasService.estornarPagamento.mockResolvedValueOnce(refund());

    await service.solicitarReembolso(1, CLIENTE);

    expect(asaasService.estornarPagamento).toHaveBeenCalledTimes(1);
  });

  // N — duas requisições simultâneas: só uma ganha o claim e chama o Asaas.
  it('N: duas requisições simultâneas — só uma ganha o claim e chama o Asaas', async () => {
    pedidoFake.asaasPaymentId = 'pay_123';
    asaasService.estornarPagamento.mockResolvedValue(refund());

    const [resultadoA, resultadoB] = await Promise.all([
      service.solicitarReembolso(1, CLIENTE),
      service.solicitarReembolso(1, CLIENTE),
    ]);

    expect(asaasService.estornarPagamento).toHaveBeenCalledTimes(1);
    expect([resultadoA.status, resultadoB.status]).toEqual([
      StatusPedido.REEMBOLSO_SOLICITADO,
      StatusPedido.REEMBOLSO_SOLICITADO,
    ]);
  });

  // O — erro HTTP definitivo do Asaas: reverte REEMBOLSO_SOLICITADO -> PAGO.
  it('O: AsaasErroHttpError reverte o pedido de volta para PAGO', async () => {
    pedidoFake.asaasPaymentId = 'pay_123';
    asaasService.consultarEstornos.mockRejectedValueOnce(
      new AsaasErroHttpError('O Asaas recusou a requisição'),
    );

    await expect(service.solicitarReembolso(1, CLIENTE)).rejects.toThrow(
      AsaasErroHttpError,
    );
    expect(pedidoFake.status).toBe(StatusPedido.PAGO);
  });

  // P — timeout/erro de rede: pedido permanece REEMBOLSO_SOLICITADO (nunca
  // volta a PAGO — não sabemos se o Asaas processou a solicitação).
  it('P: AsaasIndisponivelError (timeout) mantém o pedido em REEMBOLSO_SOLICITADO', async () => {
    pedidoFake.asaasPaymentId = 'pay_123';
    asaasService.consultarEstornos.mockResolvedValueOnce([]);
    asaasService.estornarPagamento.mockRejectedValueOnce(
      new AsaasIndisponivelError('Não foi possível se comunicar com o Asaas'),
    );

    await expect(service.solicitarReembolso(1, CLIENTE)).rejects.toThrow(
      AsaasIndisponivelError,
    );
    expect(pedidoFake.status).toBe(StatusPedido.REEMBOLSO_SOLICITADO);
  });

  // Q — refund PENDING retornado pelo próprio POST /refund: não marca
  // REEMBOLSADO.
  it('Q: POST /refund retornando PENDING não marca REEMBOLSADO', async () => {
    pedidoFake.asaasPaymentId = 'pay_123';
    asaasService.consultarEstornos.mockResolvedValueOnce([]);
    asaasService.estornarPagamento.mockResolvedValueOnce(
      refund({ status: 'PENDING' }),
    );

    const resultado = await service.solicitarReembolso(1, CLIENTE);

    expect(resultado.status).toBe(StatusPedido.REEMBOLSO_SOLICITADO);
    expect(resultado.status).not.toBe(StatusPedido.REEMBOLSADO);
  });
});
