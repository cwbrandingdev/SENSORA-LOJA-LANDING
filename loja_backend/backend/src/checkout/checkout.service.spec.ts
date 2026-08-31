import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import { AsaasService } from '../asaas/asaas.service';
import { EnderecosService } from '../enderecos/enderecos.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../produtos/produtos.service';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { CheckoutService } from './checkout.service';

// Task 15 (Stripe, modo de rollback) + Task 21 (Asaas, gateway padrão) —
// suíte de testes automatizados com MOCKS controlados (Prisma,
// ProdutosService, EnderecosService, ConfigService, AsaasService). Em
// ambos os ramos, a ÚNICA coisa que NÃO é mockada é a própria verificação
// de autenticidade do webhook:
// - Stripe: `stripe.webhooks.generateTestHeaderString` (helper oficial do
//   SDK, só matemática local — HMAC) assina payloads de teste de verdade, e
//   `checkoutService.handleWebhook` chama `stripe.webhooks.constructEvent`
//   de verdade contra eles.
// - Asaas: a comparação de token (`tokensIguais`, tempo constante via
//   `crypto.timingSafeEqual`) roda de verdade dentro do serviço.
// Isso prova que a validação REALMENTE rejeita payload/token
// inválido/adulterado, em vez de só simular que rejeitaria.
//
// O que esta suíte NÃO cobre (limitação conhecida de um teste com mocks,
// documentada no relatório da Task 15): a garantia de ROLLBACK real de
// `prisma.$transaction` diante de uma exceção. Aqui `$transaction` é
// mockado para simplesmente invocar o callback com um `tx` fake — suficiente
// para provar a LÓGICA (o que é chamado, em que ordem, com quais dados),
// mas não a garantia transacional do Postgres em si. Isso só pode ser
// verificado com um teste de integração contra um banco real (ver seção
// "Teste real" do relatório).

const STRIPE_WEBHOOK_SECRET = 'whsec_teste_fake_para_assinatura_local';
const STRIPE_SECRET_KEY = 'sk_test_fake_nao_faz_chamada_de_rede';
const ASAAS_WEBHOOK_TOKEN = 'asaas_token_teste_fake_para_comparacao_local';

function assinarEventoStripe(event: Record<string, unknown>): {
  payload: string;
  signature: string;
} {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
  });
  return { payload, signature };
}

function construirEventoCheckoutCompletoStripe(sessionId: string) {
  return {
    id: `evt_${sessionId}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
      },
    },
  };
}

describe('CheckoutService — webhook Stripe (Task 15, modo de rollback)', () => {
  let service: CheckoutService;
  let prisma: {
    pedido: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let produtosService: { removerEstoque: jest.Mock };
  let txPedidoUpdateMany: jest.Mock;

  // "Banco" em memória simplificado — permite que os testes de idempotência
  // e "pedido já pago" reflitam uma mudança de estado real entre chamadas,
  // em vez de sempre devolver o mesmo mock estático.
  let pedidoFake: {
    id: number;
    status: StatusPedido;
    itens: { produtoId: number; quantidade: number }[];
  };

  beforeEach(async () => {
    pedidoFake = {
      id: 1,
      status: StatusPedido.PENDENTE,
      itens: [
        { produtoId: 10, quantidade: 2 },
        { produtoId: 20, quantidade: 1 },
      ],
    };

    txPedidoUpdateMany = jest.fn(
      ({ where }: { where: { id: number; status: StatusPedido } }) => {
        if (where.status === pedidoFake.status) {
          pedidoFake.status = StatusPedido.PAGO;
          return { count: 1 };
        }
        return { count: 0 };
      },
    );

    prisma = {
      pedido: {
        findUnique: jest.fn(() => pedidoFake),
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<void>) => {
          const tx = { pedido: { updateMany: txPedidoUpdateMany } };
          return callback(tx);
        },
      ),
    };

    produtosService = {
      removerEstoque: jest.fn(() => ({})),
    };

    const configValues: Record<string, string> = {
      CHECKOUT_GATEWAY: 'stripe',
      STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET,
      FRONTEND_URL: 'http://localhost:3001',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: ProdutosService, useValue: produtosService },
        { provide: EnderecosService, useValue: {} },
        { provide: AsaasService, useValue: {} },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  it('webhook válido: assinatura válida -> pedido encontrado -> PAGO -> estoque reduzido', async () => {
    const { payload, signature } = assinarEventoStripe(
      construirEventoCheckoutCompletoStripe('cs_test_123'),
    );
    pedidoFake.status = StatusPedido.PENDENTE;

    const resultado = await service.handleWebhook(
      { stripeSignature: signature },
      Buffer.from(payload),
    );

    expect(resultado).toEqual({ received: true });
    expect(prisma.pedido.findUnique).toHaveBeenCalledWith({
      where: { stripeSessionId: 'cs_test_123' },
      include: { itens: true },
    });
    expect(pedidoFake.status).toBe(StatusPedido.PAGO);
    expect(produtosService.removerEstoque).toHaveBeenCalledTimes(2);
    expect(produtosService.removerEstoque).toHaveBeenNthCalledWith(
      1,
      10,
      2,
      expect.anything(),
    );
    expect(produtosService.removerEstoque).toHaveBeenNthCalledWith(
      2,
      20,
      1,
      expect.anything(),
    );
  });

  it('assinatura inválida: webhook rejeitado -> pedido permanece PENDENTE -> estoque permanece igual', async () => {
    const { payload } = assinarEventoStripe(
      construirEventoCheckoutCompletoStripe('cs_test_123'),
    );
    pedidoFake.status = StatusPedido.PENDENTE;

    await expect(
      service.handleWebhook(
        { stripeSignature: 't=1,v1=assinatura_forjada' },
        Buffer.from(payload),
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
    expect(produtosService.removerEstoque).not.toHaveBeenCalled();
    expect(pedidoFake.status).toBe(StatusPedido.PENDENTE);
  });

  it('assinatura de payload adulterado (assinado com outro secret): também rejeitado', async () => {
    const payload = JSON.stringify(
      construirEventoCheckoutCompletoStripe('cs_test_123'),
    );
    const assinaturaComSecretErrado = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_outro_secret_completamente_diferente',
    });

    await expect(
      service.handleWebhook(
        { stripeSignature: assinaturaComSecretErrado },
        Buffer.from(payload),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(produtosService.removerEstoque).not.toHaveBeenCalled();
  });

  it('evento duplicado: 1ª vez paga + baixa estoque, 2ª vez não baixa de novo', async () => {
    const evento = construirEventoCheckoutCompletoStripe('cs_test_123');
    const { payload, signature } = assinarEventoStripe(evento);
    pedidoFake.status = StatusPedido.PENDENTE;

    await service.handleWebhook(
      { stripeSignature: signature },
      Buffer.from(payload),
    );
    expect(produtosService.removerEstoque).toHaveBeenCalledTimes(2);
    expect(pedidoFake.status).toBe(StatusPedido.PAGO);

    // Mesmo evento, reenviado (reentrega do Stripe) — assina de novo com o
    // mesmo payload (Stripe reenvia o corpo idêntico em cada tentativa).
    const resultado2 = await service.handleWebhook(
      { stripeSignature: signature },
      Buffer.from(payload),
    );

    expect(resultado2).toEqual({ received: true });
    // Nenhuma baixa NOVA — continua em 2 chamadas totais desde o início do
    // teste, não 4.
    expect(produtosService.removerEstoque).toHaveBeenCalledTimes(2);
    expect(pedidoFake.status).toBe(StatusPedido.PAGO);
  });

  it('pedido já pago: evento recebido de novo -> continua PAGO, estoque não sofre nova alteração', async () => {
    pedidoFake.status = StatusPedido.PAGO;
    const { payload, signature } = assinarEventoStripe(
      construirEventoCheckoutCompletoStripe('cs_test_123'),
    );

    const resultado = await service.handleWebhook(
      { stripeSignature: signature },
      Buffer.from(payload),
    );

    expect(resultado).toEqual({ received: true });
    expect(produtosService.removerEstoque).not.toHaveBeenCalled();
    expect(pedidoFake.status).toBe(StatusPedido.PAGO);
  });

  it('estoque: quantidade descontada vem dos itens persistidos no pedido, nunca de dado externo', async () => {
    pedidoFake.itens = [{ produtoId: 77, quantidade: 5 }];
    pedidoFake.status = StatusPedido.PENDENTE;
    const { payload, signature } = assinarEventoStripe(
      construirEventoCheckoutCompletoStripe('cs_test_123'),
    );

    await service.handleWebhook(
      { stripeSignature: signature },
      Buffer.from(payload),
    );

    expect(produtosService.removerEstoque).toHaveBeenCalledWith(
      77,
      5,
      expect.anything(),
    );
  });

  it('estoque insuficiente: removerEstoque lança -> transação propaga o erro (pedido não fica PAGO sem estoque baixado)', async () => {
    pedidoFake.status = StatusPedido.PENDENTE;
    produtosService.removerEstoque.mockRejectedValueOnce(
      new BadRequestException('Estoque insuficiente para o produto com id 10'),
    );
    const { payload, signature } = assinarEventoStripe(
      construirEventoCheckoutCompletoStripe('cs_test_123'),
    );

    await expect(
      service.handleWebhook(
        { stripeSignature: signature },
        Buffer.from(payload),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('evento incompatível: tipo diferente de checkout.session.completed não marca pago nem altera estoque', async () => {
    const eventoIncompativel = {
      id: 'evt_outro',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_123', object: 'payment_intent' } },
    };
    const { payload, signature } = assinarEventoStripe(eventoIncompativel);
    pedidoFake.status = StatusPedido.PENDENTE;

    const resultado = await service.handleWebhook(
      { stripeSignature: signature },
      Buffer.from(payload),
    );

    expect(resultado).toEqual({ received: true });
    expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
    expect(produtosService.removerEstoque).not.toHaveBeenCalled();
    expect(pedidoFake.status).toBe(StatusPedido.PENDENTE);
  });

  it('pedido inexistente: evento válido sem pedido correspondente -> não cria pedido, não altera estoque, responde controlado', async () => {
    prisma.pedido.findUnique.mockResolvedValueOnce(null);
    const { payload, signature } = assinarEventoStripe(
      construirEventoCheckoutCompletoStripe('cs_test_sem_pedido'),
    );

    const resultado = await service.handleWebhook(
      { stripeSignature: signature },
      Buffer.from(payload),
    );

    expect(resultado).toEqual({ received: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(produtosService.removerEstoque).not.toHaveBeenCalled();
  });

  it('STRIPE_WEBHOOK_SECRET ausente: rejeita antes de tentar validar qualquer assinatura', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({ CHECKOUT_GATEWAY: 'stripe', STRIPE_SECRET_KEY })[key],
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: ProdutosService, useValue: produtosService },
        { provide: EnderecosService, useValue: {} },
        { provide: AsaasService, useValue: {} },
      ],
    }).compile();
    const servicoSemWebhookSecret =
      module.get<CheckoutService>(CheckoutService);

    await expect(
      servicoSemWebhookSecret.handleWebhook(
        { stripeSignature: 'qualquer' },
        Buffer.from('{}'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
  });
});

// Task 21 — mesma suíte, agora para o gateway padrão (Asaas). O Asaas não
// assina o corpo (sem HMAC): autentica o webhook só com um token estático
// no header `asaas-access-token`, comparado em tempo constante contra
// ASAAS_WEBHOOK_TOKEN (ver tokensIguais em checkout.service.ts).
describe('CheckoutService — webhook Asaas (Task 21, gateway padrão)', () => {
  let service: CheckoutService;
  let prisma: {
    pedido: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let produtosService: { removerEstoque: jest.Mock };
  let txPedidoUpdateMany: jest.Mock;

  let pedidoFake: {
    id: number;
    status: StatusPedido;
    itens: { produtoId: number; quantidade: number }[];
  };

  function construirEventoCheckoutPago(checkoutId: string) {
    return JSON.stringify({
      id: `evt_${checkoutId}`,
      event: 'CHECKOUT_PAID',
      checkout: { id: checkoutId, status: 'PAID' },
    });
  }

  beforeEach(async () => {
    pedidoFake = {
      id: 1,
      status: StatusPedido.PENDENTE,
      itens: [
        { produtoId: 10, quantidade: 2 },
        { produtoId: 20, quantidade: 1 },
      ],
    };

    txPedidoUpdateMany = jest.fn(
      ({ where }: { where: { id: number; status: StatusPedido } }) => {
        if (where.status === pedidoFake.status) {
          pedidoFake.status = StatusPedido.PAGO;
          return { count: 1 };
        }
        return { count: 0 };
      },
    );

    prisma = {
      pedido: {
        findUnique: jest.fn(() => pedidoFake),
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<void>) => {
          const tx = { pedido: { updateMany: txPedidoUpdateMany } };
          return callback(tx);
        },
      ),
    };

    produtosService = {
      removerEstoque: jest.fn(() => ({})),
    };

    const configValues: Record<string, string> = {
      CHECKOUT_GATEWAY: 'asaas',
      ASAAS_WEBHOOK_TOKEN,
      FRONTEND_URL: 'http://localhost:3001',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: ProdutosService, useValue: produtosService },
        { provide: EnderecosService, useValue: {} },
        { provide: AsaasService, useValue: {} },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  it('webhook válido: token correto -> pedido encontrado -> PAGO -> estoque reduzido', async () => {
    const payload = construirEventoCheckoutPago('chk_123');
    pedidoFake.status = StatusPedido.PENDENTE;

    const resultado = await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(payload),
    );

    expect(resultado).toEqual({ received: true });
    expect(prisma.pedido.findUnique).toHaveBeenCalledWith({
      where: { asaasCheckoutId: 'chk_123' },
      include: { itens: true },
    });
    expect(pedidoFake.status).toBe(StatusPedido.PAGO);
    expect(produtosService.removerEstoque).toHaveBeenCalledTimes(2);
  });

  it('token ausente: rejeitado -> pedido permanece PENDENTE, estoque intacto', async () => {
    const payload = construirEventoCheckoutPago('chk_123');
    pedidoFake.status = StatusPedido.PENDENTE;

    await expect(
      service.handleWebhook({}, Buffer.from(payload)),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
    expect(produtosService.removerEstoque).not.toHaveBeenCalled();
    expect(pedidoFake.status).toBe(StatusPedido.PENDENTE);
  });

  it('token incorreto (mesmo tamanho): rejeitado', async () => {
    const payload = construirEventoCheckoutPago('chk_123');

    await expect(
      service.handleWebhook(
        { asaasAccessToken: 'x'.repeat(ASAAS_WEBHOOK_TOKEN.length) },
        Buffer.from(payload),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(produtosService.removerEstoque).not.toHaveBeenCalled();
  });

  it('payload malformado (JSON inválido): rejeitado mesmo com token correto', async () => {
    await expect(
      service.handleWebhook(
        { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
        Buffer.from('não é json'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(produtosService.removerEstoque).not.toHaveBeenCalled();
  });

  it('evento duplicado: 1ª vez paga + baixa estoque, 2ª vez não baixa de novo', async () => {
    const payload = construirEventoCheckoutPago('chk_123');
    pedidoFake.status = StatusPedido.PENDENTE;

    await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(payload),
    );
    expect(produtosService.removerEstoque).toHaveBeenCalledTimes(2);
    expect(pedidoFake.status).toBe(StatusPedido.PAGO);

    // Mesmo evento reentregue ("at least once" é a política de entrega
    // documentada do Asaas) — mesmo payload, mesmo token.
    const resultado2 = await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(payload),
    );

    expect(resultado2).toEqual({ received: true });
    expect(produtosService.removerEstoque).toHaveBeenCalledTimes(2);
    expect(pedidoFake.status).toBe(StatusPedido.PAGO);
  });

  it('evento incompatível (CHECKOUT_CREATED): não marca pago nem altera estoque', async () => {
    const payload = JSON.stringify({
      id: 'evt_outro',
      event: 'CHECKOUT_CREATED',
      checkout: { id: 'chk_123', status: 'ACTIVE' },
    });
    pedidoFake.status = StatusPedido.PENDENTE;

    const resultado = await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(payload),
    );

    expect(resultado).toEqual({ received: true });
    expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
    expect(produtosService.removerEstoque).not.toHaveBeenCalled();
    expect(pedidoFake.status).toBe(StatusPedido.PENDENTE);
  });

  it('pedido inexistente: evento válido sem pedido correspondente -> não cria pedido, não altera estoque, responde controlado', async () => {
    prisma.pedido.findUnique.mockResolvedValueOnce(null);
    const payload = construirEventoCheckoutPago('chk_sem_pedido');

    const resultado = await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(payload),
    );

    expect(resultado).toEqual({ received: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(produtosService.removerEstoque).not.toHaveBeenCalled();
  });

  it('ASAAS_WEBHOOK_TOKEN ausente: rejeita antes de tentar validar qualquer token recebido', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({ CHECKOUT_GATEWAY: 'asaas' })[key as 'CHECKOUT_GATEWAY'],
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: ProdutosService, useValue: produtosService },
        { provide: EnderecosService, useValue: {} },
        { provide: AsaasService, useValue: {} },
      ],
    }).compile();
    const servicoSemWebhookToken = module.get<CheckoutService>(CheckoutService);

    await expect(
      servicoSemWebhookToken.handleWebhook(
        { asaasAccessToken: 'qualquer' },
        Buffer.from('{}'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
  });
});

// Task 16 (aprovado) — createSession agora rejeita produto com `ativo:
// false` antes de chegar no gateway de pagamento. Só testa esse caminho de
// erro especificamente: não mocka o gateway nem prisma.pedido.create
// porque a exceção deve interromper tudo antes disso — a própria asserção
// "não foram chamados" prova que a rejeição acontece cedo o bastante.
describe('CheckoutService — createSession: produto inativo (Task 16)', () => {
  it('rejeita com BadRequestException e nunca chega a criar pedido/sessão', async () => {
    const pedidoCreate = jest.fn();
    const enderecosService = {
      findOneForUsuario: jest.fn(() => ({ id: 1 })),
    };
    const produtosService = {
      findOne: jest.fn(() => ({
        id: 5,
        nome: 'Vela Desativada',
        ativo: false,
        quantidade: 10,
        preco: 39.9,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({ CHECKOUT_GATEWAY: 'asaas' })[key as 'CHECKOUT_GATEWAY'],
          },
        },
        {
          provide: PrismaService,
          useValue: { pedido: { create: pedidoCreate } },
        },
        { provide: ProdutosService, useValue: produtosService },
        { provide: EnderecosService, useValue: enderecosService },
        { provide: AsaasService, useValue: {} },
      ],
    }).compile();
    const service = module.get<CheckoutService>(CheckoutService);

    await expect(
      service.createSession(
        {
          itens: [{ produtoId: 5, quantidade: 1 }],
          clienteEmail: 'cliente@sensora.dev',
          clienteNome: 'Cliente',
          enderecoId: 1,
        },
        1,
      ),
    ).rejects.toThrow('Produto "Vela Desativada" não está mais disponível');

    expect(pedidoCreate).not.toHaveBeenCalled();
  });
});

describe('CheckoutService — createSession (Task 21, gateway Asaas)', () => {
  it('cria o pedido, chama AsaasService.criarCheckout com os itens certos, persiste asaasCheckoutId e devolve {sessionId, url}', async () => {
    const pedidoCreate = jest.fn(() => ({ id: 42, numero: 'PED-1' }));
    const pedidoUpdate = jest.fn();
    const enderecosService = {
      findOneForUsuario: jest.fn(() => ({ id: 1 })),
    };
    const produtosService = {
      findOne: jest.fn(() => ({
        id: 5,
        nome: 'Vela de Lavanda',
        descricao: null,
        aroma: 'Lavanda',
        imagemUrl: null,
        ativo: true,
        quantidade: 10,
        preco: 39.9,
      })),
    };
    const criarCheckout = jest.fn(() => ({
      id: 'chk_abc',
      link: 'https://sandbox.asaas.com/checkoutSession/show/chk_abc',
      status: 'ACTIVE',
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                CHECKOUT_GATEWAY: 'asaas',
                FRONTEND_URL: 'http://localhost:3001',
              })[key as 'CHECKOUT_GATEWAY' | 'FRONTEND_URL'],
          },
        },
        {
          provide: PrismaService,
          useValue: {
            pedido: { create: pedidoCreate, update: pedidoUpdate },
          },
        },
        { provide: ProdutosService, useValue: produtosService },
        { provide: EnderecosService, useValue: enderecosService },
        { provide: AsaasService, useValue: { criarCheckout } },
      ],
    }).compile();
    const service = module.get<CheckoutService>(CheckoutService);

    const resultado = await service.createSession(
      {
        itens: [{ produtoId: 5, quantidade: 2 }],
        clienteEmail: 'cliente@sensora.dev',
        clienteNome: 'Cliente',
        enderecoId: 1,
      },
      1,
    );

    expect(criarCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: '42',
        items: [{ name: 'Vela de Lavanda', quantity: 2, value: 39.9 }],
        callback: {
          successUrl: 'http://localhost:3001/checkout/sucesso',
          cancelUrl: 'http://localhost:3001/checkout/cancelado',
        },
      }),
    );
    expect(pedidoUpdate).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { asaasCheckoutId: 'chk_abc' },
    });
    expect(resultado).toEqual({
      sessionId: 'chk_abc',
      url: 'https://sandbox.asaas.com/checkoutSession/show/chk_abc',
    });
  });
});
