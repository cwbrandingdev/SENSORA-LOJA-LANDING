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
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ItensPedidoService } from '../itens-pedido/itens-pedido.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../produtos/produtos.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { StatusEnvio } from './enums/status-envio.enum';
import { StatusPedido } from './enums/status-pedido.enum';
import { PedidosController } from './pedidos.controller';
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

// Etapa 8.1 (HIGH-01 — "Admin order CRUD can fabricate PAGO" — e o
// complemento que eliminou completamente a venda manual) — prova que:
// (1) PedidosService.create() não existe mais — não há como um chamador
// (ADMIN/VENDEDOR) criar um Pedido administrativamente, nem como PENDENTE
// (a única origem de um Pedido novo é CheckoutService.createSession, que
// grava direto via Prisma, nunca por este service); e (2) update() nunca
// consegue gravar um Pedido como PAGO — só repassa numero/data/total ao
// Prisma, nunca um spread genérico do DTO que pudesse incluir `status` no
// futuro sem uma linha nova e visível no service. A única origem legítima
// de PAGO continua sendo CheckoutService.confirmarPagamento() (webhook
// CHECKOUT_PAID) — fora do escopo deste describe (coberto em
// checkout.service.spec.ts).
describe('PedidosService — create/update (Etapa 8.1, fechamento do HIGH-01 + eliminação da venda manual)', () => {
  let service: PedidosService;
  let prisma: {
    pedido: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  const ADMIN: UsuarioAutenticado = {
    id: 1,
    email: 'admin@sensora.dev',
    perfil: PerfilUsuario.ADMIN,
  };
  const VENDEDOR: UsuarioAutenticado = {
    id: 50,
    email: 'vendedor@sensora.dev',
    perfil: PerfilUsuario.VENDEDOR,
  };

  beforeEach(async () => {
    prisma = {
      pedido: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: 1,
          statusEnvio: StatusEnvio.NAO_ENVIADO,
          ...data,
        })),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: 1,
          usuarioId: VENDEDOR.id,
          status: StatusPedido.PENDENTE,
          statusEnvio: StatusEnvio.NAO_ENVIADO,
          numero: 'PED-1',
          data: new Date('2026-09-01'),
          total: 100,
          ...data,
        })),
        findUnique: jest.fn(() => ({
          id: 1,
          usuarioId: VENDEDOR.id,
          status: StatusPedido.PENDENTE,
          statusEnvio: StatusEnvio.NAO_ENVIADO,
          numero: 'PED-1',
          data: new Date('2026-09-01'),
          total: 100,
        })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosService,
        { provide: PrismaService, useValue: prisma },
        { provide: ItensPedidoService, useValue: {} },
        { provide: ProdutosService, useValue: {} },
        { provide: AsaasService, useValue: {} },
      ],
    }).compile();

    service = module.get(PedidosService);
  });

  // Caso A (complemento — eliminação da venda manual) — não existe mais
  // criação administrativa de Pedido: PedidosService não tem método
  // `create`, e PedidosController não tem handler `create` nem rota POST
  // "" — uma chamada HTTP direta a POST /pedidos falha porque a operação
  // não existe mais no controller (404 do próprio Nest, rota nunca
  // registrada), não porque um valor foi filtrado.
  it('Caso A: PedidosService não expõe mais create() — criação administrativa de Pedido não existe', () => {
    expect((service as unknown as { create?: unknown }).create).toBeUndefined();
    expect(prisma.pedido.create).not.toHaveBeenCalled();
  });

  it('Caso A: PedidosController não expõe mais handler create() — POST /pedidos não existe', () => {
    expect(
      (PedidosController.prototype as unknown as { create?: unknown }).create,
    ).toBeUndefined();
  });

  // Caso B/C/D — PUT /pedidos/:id nunca aceita `status`: mesmo com um
  // pedido PENDENTE existente (Caso C) e um chamador VENDEDOR (Caso D), o
  // valor injetado no payload (bypass do DTO real) nunca chega ao Prisma —
  // update() só repassa numero/data/total.
  it('Caso B/C/D: update() nunca repassa status ao Prisma, mesmo com status:"PAGO" injetado (pedido PENDENTE, chamador VENDEDOR)', async () => {
    const dtoComBypass = {
      numero: 'PED-1-revisado',
      status: StatusPedido.PAGO,
    } as unknown as UpdatePedidoDto;

    const resultado = await service.update(1, dtoComBypass, VENDEDOR);

    expect(resultado.status).toBe(StatusPedido.PENDENTE);
    expect(prisma.pedido.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { numero: 'PED-1-revisado' },
    });
    expect(
      (prisma.pedido.update.mock.calls[0][0] as { data: Record<string, unknown> })
        .data,
    ).not.toHaveProperty('status');
  });

  it('update() continua editando numero/data/total normalmente (nenhuma regressão do CRUD legítimo)', async () => {
    const resultado = await service.update(
      1,
      { numero: 'PED-1-b', data: '2026-09-05', total: 250 },
      ADMIN,
    );

    expect(prisma.pedido.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { numero: 'PED-1-b', data: new Date('2026-09-05'), total: 250 },
    });
    expect(resultado.total).toBe(250);
  });
});

// Etapa 8.2 (HIGH-02 — "Admin order CRUD can hard-delete financially
// relevant orders") — prova que PedidosService.remove() só exclui pedidos
// PENDENTE; qualquer outro status (PAGO, CANCELADO, REEMBOLSO_SOLICITADO,
// REEMBOLSADO) é sempre rejeitado com ConflictException (409), e o pedido
// permanece intacto no "banco". `pedidoFake` vira `null` quando
// `deleteMany` de fato "apaga" (mesmo padrão de pedidoFake em memória já
// usado no describe de solicitarReembolso/marcarComoEnviado acima) — é
// esse `null` que prova, nos casos B-E, que nenhuma exclusão aconteceu.
describe('PedidosService — remove (Etapa 8.2, fechamento do HIGH-02)', () => {
  let service: PedidosService;
  let prisma: {
    pedido: {
      findUnique: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let pedidoFake: { id: number; usuarioId: number; status: StatusPedido } | null;

  const ADMIN: UsuarioAutenticado = {
    id: 1,
    email: 'admin@sensora.dev',
    perfil: PerfilUsuario.ADMIN,
  };
  const VENDEDOR_DONO: UsuarioAutenticado = {
    id: 60,
    email: 'dono@sensora.dev',
    perfil: PerfilUsuario.VENDEDOR,
  };
  const OUTRO_VENDEDOR: UsuarioAutenticado = {
    id: 61,
    email: 'outro-vendedor@sensora.dev',
    perfil: PerfilUsuario.VENDEDOR,
  };

  beforeEach(async () => {
    pedidoFake = { id: 1, usuarioId: VENDEDOR_DONO.id, status: StatusPedido.PENDENTE };

    prisma = {
      pedido: {
        findUnique: jest.fn(({ where }: { where: { id: number } }) => {
          if (!pedidoFake || pedidoFake.id !== where.id) return null;
          return { ...pedidoFake };
        }),
        // Simula o comportamento real do deleteMany condicional do
        // Postgres (mesmo raciocínio de updateMany já usado em
        // cancelar()/solicitarReembolso()/marcarComoEnviado): só "apaga"
        // (e retorna count:1) se TODAS as condições do WHERE baterem com o
        // estado atual — nunca dupla exclusão, nunca exclusão fora de
        // PENDENTE.
        deleteMany: jest.fn(
          ({
            where,
          }: {
            where: { id: number; status?: StatusPedido; usuarioId?: number };
          }) => {
            if (!pedidoFake || pedidoFake.id !== where.id) return { count: 0 };
            const ownerOk =
              where.usuarioId === undefined || where.usuarioId === pedidoFake.usuarioId;
            const statusOk =
              where.status === undefined || where.status === pedidoFake.status;
            if (ownerOk && statusOk) {
              pedidoFake = null;
              return { count: 1 };
            }
            return { count: 0 };
          },
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosService,
        { provide: PrismaService, useValue: prisma },
        { provide: ItensPedidoService, useValue: {} },
        { provide: ProdutosService, useValue: {} },
        { provide: AsaasService, useValue: {} },
      ],
    }).compile();

    service = module.get(PedidosService);
  });

  // Caso A
  it('A: pedido PENDENTE é excluído com sucesso', async () => {
    await expect(service.remove(1, ADMIN)).resolves.toBeUndefined();

    expect(prisma.pedido.deleteMany).toHaveBeenCalledWith({
      where: { id: 1, status: StatusPedido.PENDENTE },
    });
    expect(pedidoFake).toBeNull();
  });

  // Caso B
  it('B: pedido PAGO retorna 409 e continua existindo', async () => {
    pedidoFake!.status = StatusPedido.PAGO;

    await expect(service.remove(1, ADMIN)).rejects.toThrow(ConflictException);
    expect(pedidoFake).not.toBeNull();
    expect(pedidoFake?.status).toBe(StatusPedido.PAGO);
  });

  // Caso C
  it('C: pedido REEMBOLSO_SOLICITADO retorna 409 e continua existindo', async () => {
    pedidoFake!.status = StatusPedido.REEMBOLSO_SOLICITADO;

    await expect(service.remove(1, ADMIN)).rejects.toThrow(ConflictException);
    expect(pedidoFake).not.toBeNull();
    expect(pedidoFake?.status).toBe(StatusPedido.REEMBOLSO_SOLICITADO);
  });

  // Caso D
  it('D: pedido REEMBOLSADO retorna 409 e continua existindo', async () => {
    pedidoFake!.status = StatusPedido.REEMBOLSADO;

    await expect(service.remove(1, ADMIN)).rejects.toThrow(ConflictException);
    expect(pedidoFake).not.toBeNull();
    expect(pedidoFake?.status).toBe(StatusPedido.REEMBOLSADO);
  });

  // Caso E
  it('E: pedido CANCELADO retorna 409 e continua existindo', async () => {
    pedidoFake!.status = StatusPedido.CANCELADO;

    await expect(service.remove(1, ADMIN)).rejects.toThrow(ConflictException);
    expect(pedidoFake).not.toBeNull();
    expect(pedidoFake?.status).toBe(StatusPedido.CANCELADO);
  });

  // Caso F — o mock de Prisma acima deliberadamente NÃO define
  // `prisma.itemPedido`: se remove() tentasse manipular ItemPedido
  // diretamente (nova regra de estoque/limpeza manual), a chamada
  // explodiria com TypeError e este teste falharia. Passar prova que a
  // exclusão depende inteiramente do `onDelete: Cascade` já declarado em
  // ItemPedido.pedido (schema.prisma) — nenhuma lógica nova precisou ser
  // criada.
  it('F: exclusão de PENDENTE nunca manipula ItemPedido diretamente — depende só do cascade do schema', async () => {
    await expect(service.remove(1, ADMIN)).resolves.toBeUndefined();
  });

  // Caso G — autorização preservada: mesmo padrão de ownership já usado em
  // cancelar()/solicitarReembolso()/marcarComoEnviado. VENDEDOR só pode
  // excluir o PRÓPRIO pedido PENDENTE; pedido de outro usuário nunca é
  // sequer alcançado (404 do findOne(), deleteMany nunca chamado) — a
  // correção do HIGH-02 não amplia nem restringe quem pode operar, só
  // A QUAL status a operação se aplica.
  it('G: VENDEDOR não consegue excluir pedido PENDENTE de outro usuário (404, ownership preservada — nunca 409)', async () => {
    await expect(service.remove(1, OUTRO_VENDEDOR)).rejects.toThrow(NotFoundException);
    expect(prisma.pedido.deleteMany).not.toHaveBeenCalled();
    expect(pedidoFake).not.toBeNull();
  });

  it('G: VENDEDOR consegue excluir o próprio pedido PENDENTE (autorização não foi restringida pela correção)', async () => {
    await expect(service.remove(1, VENDEDOR_DONO)).resolves.toBeUndefined();
    expect(pedidoFake).toBeNull();
  });

  // Item 3 da etapa — atomicidade contra corrida: duas exclusões
  // simultâneas do mesmo pedido PENDENTE (mesmo padrão de Promise.all já
  // usado nos describes de solicitarReembolso/marcarComoEnviado, item
  // N/H) — o Postgres serializa via o WHERE condicional, só uma vê
  // count:1 e tem sucesso; a outra vê count:0 e recebe 409, nunca uma
  // dupla exclusão.
  it('H: duas exclusões simultâneas do mesmo pedido PENDENTE — só uma tem sucesso, a outra recebe 409', async () => {
    const resultados = await Promise.allSettled([
      service.remove(1, ADMIN),
      service.remove(1, ADMIN),
    ]);

    const sucesso = resultados.filter((r) => r.status === 'fulfilled');
    const falha = resultados.filter((r) => r.status === 'rejected');
    expect(sucesso).toHaveLength(1);
    expect(falha).toHaveLength(1);
    expect(prisma.pedido.deleteMany).toHaveBeenCalledTimes(2);
    expect(pedidoFake).toBeNull();
  });
});

// Tarefa "Ordenar pedidos do Admin do mais recente para o mais antigo" —
// prova que `ordenarPorDataDesc` (opt-in, usado só pelo controller em
// GET /pedidos) pede ao Prisma `orderBy: { data: 'desc' }`, e que sem a
// opção (GET /pedidos/meus) o comportamento anterior é preservado — nenhum
// `orderBy` é passado. Não reusa o describe acima: findAll não precisa de
// ItensPedidoService/AsaasService, só do Prisma mockado.
describe('PedidosService — findAll (ordenação da listagem do Admin)', () => {
  let service: PedidosService;
  let findMany: jest.Mock;

  const ADMIN: UsuarioAutenticado = {
    id: 99,
    email: 'admin@sensora.dev',
    perfil: PerfilUsuario.ADMIN,
  };

  beforeEach(async () => {
    findMany = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosService,
        { provide: PrismaService, useValue: { pedido: { findMany } } },
        { provide: ItensPedidoService, useValue: {} },
        { provide: ProdutosService, useValue: {} },
        { provide: AsaasService, useValue: {} },
      ],
    }).compile();

    service = module.get(PedidosService);
  });

  it('com ordenarPorDataDesc: pede ao Prisma orderBy: { data: "desc" } (usado pelo GET /pedidos do Admin)', async () => {
    await service.findAll(ADMIN, { ordenarPorDataDesc: true });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { data: 'desc' } }),
    );
  });

  it('sem a opção (GET /pedidos/meus): nenhum orderBy é passado — comportamento anterior preservado', async () => {
    await service.findAll(CLIENTE);

    const argumentos = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(argumentos).not.toHaveProperty('orderBy');
  });

  it('pedido mais recente aparece primeiro, mais antigo depois (ordem devolvida pelo Prisma é preservada)', async () => {
    const maisAntigo = { id: 1, data: new Date('2026-01-01'), status: StatusPedido.PAGO };
    const maisRecente = { id: 2, data: new Date('2026-09-01'), status: StatusPedido.PAGO };
    // Simula o Postgres já aplicando `orderBy: { data: 'desc' }' — devolve
    // na ordem que o banco devolveria com essa cláusula.
    findMany.mockResolvedValueOnce([maisRecente, maisAntigo]);

    const resultado = await service.findAll(ADMIN, { ordenarPorDataDesc: true });

    expect(resultado[0].id).toBe(maisRecente.id);
    expect(resultado[1].id).toBe(maisAntigo.id);
  });
});

// Etapa 6.6 (Status de Envio) — testa só a regra de negócio de
// PedidosService.marcarComoEnviado com Prisma mockado (mesmo padrão de
// pedidoFake em memória + updateMany condicional já usado no describe de
// solicitarReembolso acima — nenhum AsaasService envolvido aqui, marcar como
// enviado não chama nenhum gateway externo).
describe('PedidosService — marcarComoEnviado (Etapa 6.6)', () => {
  let service: PedidosService;
  let prisma: {
    pedido: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let pedidoFake: {
    id: number;
    usuarioId: number;
    status: StatusPedido;
    statusEnvio: StatusEnvio;
    enviadoEm: Date | null;
    numero: string;
    data: Date;
    total: number;
  };

  const ADMIN: UsuarioAutenticado = {
    id: 99,
    email: 'admin@sensora.dev',
    perfil: PerfilUsuario.ADMIN,
  };
  const VENDEDOR: UsuarioAutenticado = {
    id: 50,
    email: 'vendedor@sensora.dev',
    perfil: PerfilUsuario.VENDEDOR,
  };

  beforeEach(async () => {
    pedidoFake = {
      id: 1,
      usuarioId: CLIENTE.id,
      status: StatusPedido.PAGO,
      statusEnvio: StatusEnvio.NAO_ENVIADO,
      enviadoEm: null,
      numero: 'PED-1',
      data: new Date('2026-09-01'),
      total: 39.9,
    };

    prisma = {
      pedido: {
        findUnique: jest.fn(() => ({ ...pedidoFake })),
        // Mesmo raciocínio do updateMany de solicitarReembolso: só aplica
        // (e retorna count:1) se TODAS as condições do WHERE baterem com o
        // estado atual — é isso que torna o claim atômico testável tanto
        // para a regra de negócio (status/statusEnvio errados) quanto para
        // concorrência (item H).
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: {
              status?: StatusPedido;
              statusEnvio?: StatusEnvio;
              usuarioId?: number;
            };
            data: Record<string, unknown>;
          }) => {
            const ownerOk =
              where.usuarioId === undefined ||
              where.usuarioId === pedidoFake.usuarioId;
            const statusOk =
              where.status === undefined || where.status === pedidoFake.status;
            const statusEnvioOk =
              where.statusEnvio === undefined ||
              where.statusEnvio === pedidoFake.statusEnvio;

            if (ownerOk && statusOk && statusEnvioOk) {
              Object.assign(pedidoFake, data);
              return { count: 1 };
            }
            return { count: 0 };
          },
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosService,
        { provide: PrismaService, useValue: prisma },
        { provide: ItensPedidoService, useValue: {} },
        { provide: ProdutosService, useValue: {} },
        { provide: AsaasService, useValue: {} },
      ],
    }).compile();

    service = module.get(PedidosService);
  });

  // A — PAGO + NAO_ENVIADO: pode marcar como enviado.
  it('A: pedido PAGO + NAO_ENVIADO pode ser marcado como enviado', async () => {
    await expect(service.marcarComoEnviado(1, ADMIN)).resolves.toBeDefined();
  });

  // B — depois de marcar: statusEnvio === ENVIADO e enviadoEm !== null.
  it('B: após marcar, statusEnvio é ENVIADO e enviadoEm é preenchido', async () => {
    const resultado = await service.marcarComoEnviado(1, ADMIN);

    expect(resultado.statusEnvio).toBe(StatusEnvio.ENVIADO);
    expect(resultado.enviadoEm).toBeInstanceOf(Date);
  });

  // C/D/E/F — só PAGO pode ser marcado como enviado; os demais status
  // financeiros são sempre rejeitados com 409, sem alterar statusEnvio.
  it('C: pedido PENDENTE é bloqueado (409), statusEnvio permanece NAO_ENVIADO', async () => {
    pedidoFake.status = StatusPedido.PENDENTE;

    await expect(service.marcarComoEnviado(1, ADMIN)).rejects.toThrow(
      ConflictException,
    );
    expect(pedidoFake.statusEnvio).toBe(StatusEnvio.NAO_ENVIADO);
  });

  it('D: pedido CANCELADO é bloqueado (409)', async () => {
    pedidoFake.status = StatusPedido.CANCELADO;

    await expect(service.marcarComoEnviado(1, ADMIN)).rejects.toThrow(
      ConflictException,
    );
  });

  it('E: pedido REEMBOLSO_SOLICITADO é bloqueado (409)', async () => {
    pedidoFake.status = StatusPedido.REEMBOLSO_SOLICITADO;

    await expect(service.marcarComoEnviado(1, ADMIN)).rejects.toThrow(
      ConflictException,
    );
  });

  it('F: pedido REEMBOLSADO é bloqueado (409)', async () => {
    pedidoFake.status = StatusPedido.REEMBOLSADO;

    await expect(service.marcarComoEnviado(1, ADMIN)).rejects.toThrow(
      ConflictException,
    );
  });

  // G — idempotência: pedido já ENVIADO não dispara um novo claim nem
  // sobrescreve enviadoEm — só devolve o estado atual.
  it('G: pedido já ENVIADO é idempotente — não altera enviadoEm numa segunda chamada', async () => {
    const dataOriginal = new Date('2026-09-01T12:00:00.000Z');
    pedidoFake.statusEnvio = StatusEnvio.ENVIADO;
    pedidoFake.enviadoEm = dataOriginal;

    const resultado = await service.marcarComoEnviado(1, ADMIN);

    expect(resultado.statusEnvio).toBe(StatusEnvio.ENVIADO);
    expect(resultado.enviadoEm).toEqual(dataOriginal);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  // H — duas requisições simultâneas (mesmo padrão de Promise.all já usado
  // no describe de solicitarReembolso, item N): as duas tentam o claim
  // (updateMany é chamado 2x), mas o WHERE condicional só bate para a
  // primeira a executar (statusEnvio ainda NAO_ENVIADO naquele instante) —
  // a segunda encontra statusEnvio já ENVIADO, recebe count:0, cai no ramo
  // de idempotência (reconsulta em vez de tentar de novo) e nunca
  // sobrescreve o `enviadoEm` estabelecido pela primeira.
  it('H: duas requisições simultâneas — só uma estabelece enviadoEm, a outra não sobrescreve', async () => {
    const [resultadoA, resultadoB] = await Promise.all([
      service.marcarComoEnviado(1, ADMIN),
      service.marcarComoEnviado(1, ADMIN),
    ]);

    // Ambas as chamadas tentam o claim (updateMany é chamado 2x), mas só
    // uma bate o WHERE (statusEnvio ainda NAO_ENVIADO no momento exato da
    // sua execução) — a que perde recebe count:0 e nunca escreve
    // enviadoEm de novo, por isso os dois resultados batem exatamente.
    const claims = prisma.pedido.updateMany.mock.results.map(
      (resultado) => (resultado.value as { count: number }).count,
    );
    expect(claims.filter((count) => count === 1)).toHaveLength(1);
    expect(resultadoA.enviadoEm).toEqual(resultadoB.enviadoEm);
    expect(resultadoA.statusEnvio).toBe(StatusEnvio.ENVIADO);
    expect(resultadoB.statusEnvio).toBe(StatusEnvio.ENVIADO);
  });

  // I — autorização: VENDEDOR (staff) tentando marcar como enviado um
  // pedido que NÃO é seu (usuarioId de outro usuário) é bloqueado pela
  // mesma checagem de ownership (podeAcessar/findOne) usada por todo o
  // resto do PedidosService — não é enfraquecida por esta nova operação.
  // O acesso STAFF-only da rota em si (RolesGuard + @Roles(...STAFF_ROLES)
  // herdado da classe, sem override) não muda nesta etapa — verificado por
  // inspeção do controller, não repetido aqui como teste de unidade do
  // guard (já coberto pelos testes existentes de RolesGuard/e2e do
  // projeto).
  it('I: VENDEDOR tentando marcar pedido de outro usuário é bloqueado (404, ownership)', async () => {
    await expect(service.marcarComoEnviado(1, VENDEDOR)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });
});
