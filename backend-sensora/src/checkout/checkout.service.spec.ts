import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Stripe from 'stripe';
import { AsaasService } from '../asaas/asaas.service';
import { EnderecosService } from '../enderecos/enderecos.service';
import { MelhorEnvioService } from '../melhor-envio/melhor-envio.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../produtos/produtos.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { CheckoutService } from './checkout.service';

// Etapa 6.4 (Confirmação de e-mail) — CheckoutService agora também injeta
// UsuariosService (checagem de emailVerificado em createSession), então
// TODO Test.createTestingModule que constrói CheckoutService precisa prover
// esse dependency, mesmo nas suítes de webhook que nunca chamam
// createSession (o Nest resolve o construtor inteiro, não só os métodos
// exercitados pelo teste). Stub vazio ({}) é suficiente para elas; só as
// suítes que chamam createSession precisam de um `findOne` de verdade.
const usuariosServiceVerificado = {
  findOne: jest.fn(() => ({ emailVerificado: true })),
};

// Etapa 6.5 (Frete) — endereço/opção de frete "de verdade" reaproveitados
// pelas suítes de createSession que chegam até o fim do fluxo (ver
// CheckoutService.validarFreteEscolhido, que agora sempre recotiza contra
// MelhorEnvioService antes de aceitar o pedido).
const ENDERECO_FAKE = {
  id: 1,
  usuarioId: 1,
  rua: 'Rua das Flores',
  numero: '123',
  complemento: undefined,
  bairro: 'Centro',
  cidade: 'Curitiba',
  estado: 'PR',
  cep: '80000-000',
  padrao: true,
};

const OPCAO_FRETE_FAKE = {
  id: 1,
  transportadora: 'Correios',
  servico: 'PAC',
  preco: 23.5,
  prazoDias: 9,
};

const PACOTE_PADRAO_FAKE = {
  alturaCm: 10,
  larguraCm: 15,
  comprimentoCm: 20,
  pesoGramas: 300,
};

function melhorEnvioServiceComOpcoes(opcoes: unknown[] = [OPCAO_FRETE_FAKE]) {
  return {
    cotar: jest.fn(() => opcoes),
    pacotePadraoConfigurado: PACOTE_PADRAO_FAKE,
  };
}

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
  let txItemPedidoUpdate: jest.Mock;

  // "Banco" em memória simplificado — permite que os testes de idempotência
  // e "pedido já pago" reflitam uma mudança de estado real entre chamadas,
  // em vez de sempre devolver o mesmo mock estático.
  let pedidoFake: {
    id: number;
    status: StatusPedido;
    itens: { id: number; produtoId: number; quantidade: number }[];
  };

  beforeEach(async () => {
    pedidoFake = {
      id: 1,
      status: StatusPedido.PENDENTE,
      itens: [
        { id: 100, produtoId: 10, quantidade: 2 },
        { id: 200, produtoId: 20, quantidade: 1 },
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

    // Correção da infraestrutura de testes — confirmarPagamento (Etapa
    // 5A.2) chama `tx.itemPedido.update` para marcar `estoqueBaixado: true`
    // por item, DENTRO da mesma transação usada para `tx.pedido.updateMany`
    // acima. O mock de `$transaction` precisa expor os dois, senão a
    // chamada real quebra com `Cannot read properties of undefined
    // (reading 'update')` — mascarado até agora pelo Jest carregar o `.js`
    // obsoleto (que não tinha essa chamada) em vez do `.ts` real.
    txItemPedidoUpdate = jest.fn(() => ({}));

    prisma = {
      pedido: {
        findUnique: jest.fn(() => pedidoFake),
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<void>) => {
          const tx = {
            pedido: { updateMany: txPedidoUpdateMany },
            itemPedido: { update: txItemPedidoUpdate },
          };
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
        { provide: UsuariosService, useValue: {} },
        { provide: MelhorEnvioService, useValue: {} },
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
    pedidoFake.itens = [{ id: 300, produtoId: 77, quantidade: 5 }];
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
        { provide: UsuariosService, useValue: {} },
        { provide: MelhorEnvioService, useValue: {} },
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
  let txItemPedidoUpdate: jest.Mock;

  let pedidoFake: {
    id: number;
    status: StatusPedido;
    itens: { id: number; produtoId: number; quantidade: number }[];
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
        { id: 100, produtoId: 10, quantidade: 2 },
        { id: 200, produtoId: 20, quantidade: 1 },
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

    // Correção da infraestrutura de testes — mesmo motivo do bloco Stripe
    // acima: confirmarPagamento chama `tx.itemPedido.update` dentro da
    // mesma transação, para os dois gateways (Stripe e Asaas).
    txItemPedidoUpdate = jest.fn(() => ({}));

    prisma = {
      pedido: {
        findUnique: jest.fn(() => pedidoFake),
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<void>) => {
          const tx = {
            pedido: { updateMany: txPedidoUpdateMany },
            itemPedido: { update: txItemPedidoUpdate },
          };
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
        { provide: UsuariosService, useValue: {} },
        { provide: MelhorEnvioService, useValue: {} },
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
        { provide: UsuariosService, useValue: {} },
        { provide: MelhorEnvioService, useValue: {} },
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

// Etapa 5B.5 — eventos de webhook de reembolso do Asaas
// (PAYMENT_REFUND_IN_PROGRESS, PAYMENT_REFUNDED, PAYMENT_PARTIALLY_REFUNDED,
// PAYMENT_REFUND_DENIED). Suíte separada da de CHECKOUT_PAID acima porque o
// "banco" fake precisa localizar o Pedido por `asaasPaymentId` (não por
// `asaasCheckoutId`) e o método novo (processarEventoReembolsoAsaas) chama
// `prisma.pedido.updateMany` diretamente (sem `$transaction` — não há
// baixa de estoque nesta etapa). Mesmo princípio de mock das suítes acima:
// só Prisma é mockado, a validação real de token (`tokensIguais`) roda de
// verdade dentro do serviço.
describe('CheckoutService — webhook Asaas: eventos de reembolso (Etapa 5B.5)', () => {
  let service: CheckoutService;
  let prisma: {
    pedido: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    itemPedido: {
      findMany: jest.Mock;
    };
  };
  let pedidoFake: {
    id: number;
    asaasPaymentId: string | null;
    status: StatusPedido;
  };

  function construirEventoPayment(
    evento: string,
    paymentId?: string,
  ): string {
    return JSON.stringify({
      id: `evt_${paymentId ?? 'sem_payment'}`,
      event: evento,
      ...(paymentId
        ? { payment: { id: paymentId, status: 'CONFIRMED' } }
        : {}),
    });
  }

  beforeEach(async () => {
    pedidoFake = {
      id: 1,
      asaasPaymentId: 'pay_123',
      status: StatusPedido.REEMBOLSO_SOLICITADO,
    };

    prisma = {
      pedido: {
        findUnique: jest.fn(
          ({ where }: { where: { asaasPaymentId: string } }) =>
            where.asaasPaymentId === pedidoFake.asaasPaymentId
              ? { ...pedidoFake }
              : null,
        ),
        // Mesmo raciocínio de idempotência de confirmarPagamento: só aplica
        // (e retorna count:1) se o `status` do WHERE bater com o atual —
        // é isso que torna a reentrega do mesmo evento (item C) segura de
        // testar.
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: number; status: StatusPedido };
            data: { status: StatusPedido };
          }) => {
            if (where.id === pedidoFake.id && where.status === pedidoFake.status) {
              pedidoFake.status = data.status;
              return { count: 1 };
            }
            return { count: 0 };
          },
        ),
      },
      // Etapa 5B.6 — processarEventoReembolsoAsaas agora sempre chama
      // restaurarEstoqueAposReembolso após PAYMENT_REFUNDED (mesmo em
      // reentrega, ver item 4/14 da etapa). Esta suíte (5B.5) testa só a
      // transição de status, sem itens de pedido — `findMany` retornando
      // `[]` faz o helper de restauração encerrar imediatamente (nenhum
      // item elegível), sem precisar mockar `$transaction`/ProdutosService
      // aqui. A restauração em si é testada à parte, na suíte 5B.6 abaixo.
      itemPedido: {
        findMany: jest.fn(() => []),
      },
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
        { provide: ProdutosService, useValue: {} },
        { provide: EnderecosService, useValue: {} },
        { provide: AsaasService, useValue: {} },
        { provide: UsuariosService, useValue: {} },
        { provide: MelhorEnvioService, useValue: {} },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  // A
  it('A: PAYMENT_REFUND_IN_PROGRESS mantém REEMBOLSO_SOLICITADO', async () => {
    const resultado = await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(construirEventoPayment('PAYMENT_REFUND_IN_PROGRESS', 'pay_123')),
    );

    expect(resultado).toEqual({ received: true });
    expect(pedidoFake.status).toBe(StatusPedido.REEMBOLSO_SOLICITADO);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  // B
  it('B: PAYMENT_REFUNDED transiciona REEMBOLSO_SOLICITADO -> REEMBOLSADO', async () => {
    const resultado = await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(construirEventoPayment('PAYMENT_REFUNDED', 'pay_123')),
    );

    expect(resultado).toEqual({ received: true });
    expect(pedidoFake.status).toBe(StatusPedido.REEMBOLSADO);
  });

  // C
  it('C: PAYMENT_REFUNDED entregue 3x resulta em REEMBOLSADO, sem erro nem efeito colateral extra', async () => {
    const payload = Buffer.from(
      construirEventoPayment('PAYMENT_REFUNDED', 'pay_123'),
    );

    for (let i = 0; i < 3; i++) {
      const resultado = await service.handleWebhook(
        { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
        payload,
      );
      expect(resultado).toEqual({ received: true });
    }

    expect(pedidoFake.status).toBe(StatusPedido.REEMBOLSADO);
    expect(prisma.pedido.updateMany).toHaveBeenCalledTimes(3);
  });

  // D
  it('D: PAYMENT_REFUNDED para payment.id desconhecido não altera nada', async () => {
    const resultado = await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(
        construirEventoPayment('PAYMENT_REFUNDED', 'pay_desconhecido'),
      ),
    );

    expect(resultado).toEqual({ received: true });
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
    expect(pedidoFake.status).toBe(StatusPedido.REEMBOLSO_SOLICITADO);
  });

  // E
  it('E: PAYMENT_PARTIALLY_REFUNDED não marca REEMBOLSADO', async () => {
    const resultado = await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(
        construirEventoPayment('PAYMENT_PARTIALLY_REFUNDED', 'pay_123'),
      ),
    );

    expect(resultado).toEqual({ received: true });
    expect(pedidoFake.status).toBe(StatusPedido.REEMBOLSO_SOLICITADO);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  // F
  it('F: PAYMENT_REFUND_DENIED preserva REEMBOLSO_SOLICITADO para reconciliação', async () => {
    const resultado = await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(construirEventoPayment('PAYMENT_REFUND_DENIED', 'pay_123')),
    );

    expect(resultado).toEqual({ received: true });
    expect(pedidoFake.status).toBe(StatusPedido.REEMBOLSO_SOLICITADO);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  // G
  it('G: PAYMENT_REFUNDED para pedido ainda PAGO não transiciona cegamente (máquina de estados protegida)', async () => {
    pedidoFake.status = StatusPedido.PAGO;

    const resultado = await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(construirEventoPayment('PAYMENT_REFUNDED', 'pay_123')),
    );

    expect(resultado).toEqual({ received: true });
    expect(pedidoFake.status).toBe(StatusPedido.PAGO);
  });

  // H
  it('H: PAYMENT_REFUNDED sem payment.id não consulta nem atualiza Pedido', async () => {
    const payload = JSON.stringify({
      id: 'evt_sem_payment',
      event: 'PAYMENT_REFUNDED',
    });

    const resultado = await service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(payload),
    );

    expect(resultado).toEqual({ received: true });
    expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  // I
  it('I: token do webhook inválido continua rejeitando (também para eventos de reembolso)', async () => {
    await expect(
      service.handleWebhook(
        { asaasAccessToken: 'x'.repeat(ASAAS_WEBHOOK_TOKEN.length) },
        Buffer.from(construirEventoPayment('PAYMENT_REFUNDED', 'pay_123')),
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
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
        { provide: UsuariosService, useValue: usuariosServiceVerificado },
        { provide: MelhorEnvioService, useValue: {} },
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
          freteServicoId: 1,
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
      findOneForUsuario: jest.fn(() => ENDERECO_FAKE),
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
    const melhorEnvioService = melhorEnvioServiceComOpcoes();

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
        { provide: UsuariosService, useValue: usuariosServiceVerificado },
        { provide: MelhorEnvioService, useValue: melhorEnvioService },
      ],
    }).compile();
    const service = module.get<CheckoutService>(CheckoutService);

    const resultado = await service.createSession(
      {
        itens: [{ produtoId: 5, quantidade: 2 }],
        clienteEmail: 'cliente@sensora.dev',
        clienteNome: 'Cliente',
        enderecoId: 1,
        freteServicoId: OPCAO_FRETE_FAKE.id,
      },
      1,
    );

    // Etapa 6.5 (Frete), teste H/G — o pedido persiste o snapshot do
    // endereço e o resultado da cotação já validada, e `total` já soma
    // subtotal (2 × 39,90 = 79,80) + frete (23,50).
    expect(pedidoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 103.3,
          enderecoCep: ENDERECO_FAKE.cep,
          enderecoRua: ENDERECO_FAKE.rua,
          enderecoNumero: ENDERECO_FAKE.numero,
          enderecoBairro: ENDERECO_FAKE.bairro,
          enderecoCidade: ENDERECO_FAKE.cidade,
          enderecoEstado: ENDERECO_FAKE.estado,
          freteValor: OPCAO_FRETE_FAKE.preco,
          freteTransportadora: OPCAO_FRETE_FAKE.transportadora,
          freteServico: OPCAO_FRETE_FAKE.servico,
          fretePrazoDias: OPCAO_FRETE_FAKE.prazoDias,
          freteServicoId: OPCAO_FRETE_FAKE.id,
        }),
      }),
    );

    // Etapa 6.5 (Frete), teste J — o valor enviado ao Asaas inclui o frete
    // como um item próprio, calculado pelo backend (nunca o preço do
    // cliente): o total cobrado no gateway reflete produtos + frete.
    expect(criarCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: '42',
        items: [
          { name: 'Vela de Lavanda', quantity: 2, value: 39.9 },
          { name: 'Frete - Correios PAC', quantity: 1, value: 23.5 },
        ],
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

  // Etapa 6.5 (Frete), teste D — cliente manda um `freteServicoId` que não
  // está entre as opções REALMENTE disponíveis na recotização (ele pode ter
  // adulterado o valor, ou a cotação simplesmente ficou desatualizada) —
  // nunca aceito, mesmo que pareça um id válido de outra cotação qualquer.
  it('freteServicoId que não existe entre as opções recotizadas é rejeitado, pedido nunca é criado', async () => {
    const pedidoCreate = jest.fn();
    const enderecosService = {
      findOneForUsuario: jest.fn(() => ENDERECO_FAKE),
    };
    const produtosService = {
      findOne: jest.fn(() => ({
        id: 5,
        nome: 'Vela de Lavanda',
        ativo: true,
        quantidade: 10,
        preco: 39.9,
      })),
    };
    const melhorEnvioService = melhorEnvioServiceComOpcoes([OPCAO_FRETE_FAKE]);

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
        { provide: PrismaService, useValue: { pedido: { create: pedidoCreate } } },
        { provide: ProdutosService, useValue: produtosService },
        { provide: EnderecosService, useValue: enderecosService },
        { provide: AsaasService, useValue: {} },
        { provide: UsuariosService, useValue: usuariosServiceVerificado },
        { provide: MelhorEnvioService, useValue: melhorEnvioService },
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
          freteServicoId: 999, // não existe em OPCAO_FRETE_FAKE
        },
        1,
      ),
    ).rejects.toThrow('Opção de frete indisponível');

    expect(pedidoCreate).not.toHaveBeenCalled();
  });

  // Etapa 6.5 (Frete), teste D (variação) — nenhuma opção disponível para o
  // endereço/rota (Melhor Envio devolve lista vazia) resulta no mesmo erro
  // controlado, nunca um pedido criado com frete indefinido.
  it('nenhuma opção de frete disponível: rejeita, pedido nunca é criado', async () => {
    const pedidoCreate = jest.fn();
    const enderecosService = {
      findOneForUsuario: jest.fn(() => ENDERECO_FAKE),
    };
    const produtosService = {
      findOne: jest.fn(() => ({
        id: 5,
        nome: 'Vela de Lavanda',
        ativo: true,
        quantidade: 10,
        preco: 39.9,
      })),
    };
    const melhorEnvioService = melhorEnvioServiceComOpcoes([]);

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
        { provide: PrismaService, useValue: { pedido: { create: pedidoCreate } } },
        { provide: ProdutosService, useValue: produtosService },
        { provide: EnderecosService, useValue: enderecosService },
        { provide: AsaasService, useValue: {} },
        { provide: UsuariosService, useValue: usuariosServiceVerificado },
        { provide: MelhorEnvioService, useValue: melhorEnvioService },
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
          freteServicoId: 1,
        },
        1,
      ),
    ).rejects.toThrow('Opção de frete indisponível');

    expect(pedidoCreate).not.toHaveBeenCalled();
  });
});

// Etapa 6.4 (Confirmação de e-mail) — createSession agora consulta o estado
// REAL de emailVerificado no banco (via UsuariosService.findOne) antes de
// qualquer outra validação, e bloqueia com ForbiddenException se a conta
// ainda não confirmou o e-mail. Testes H/I da etapa.
describe('CheckoutService — createSession: bloqueio por e-mail não confirmado (Etapa 6.4)', () => {
  it('H: usuário com e-mail não confirmado não consegue criar sessão de checkout', async () => {
    const pedidoCreate = jest.fn();
    const produtosService = { findOne: jest.fn() };
    const enderecosService = { findOneForUsuario: jest.fn() };

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
        { provide: PrismaService, useValue: { pedido: { create: pedidoCreate } } },
        { provide: ProdutosService, useValue: produtosService },
        { provide: EnderecosService, useValue: enderecosService },
        { provide: AsaasService, useValue: {} },
        {
          provide: UsuariosService,
          useValue: { findOne: jest.fn(() => ({ emailVerificado: false })) },
        },
        { provide: MelhorEnvioService, useValue: {} },
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
          freteServicoId: 1,
        },
        1,
      ),
    ).rejects.toThrow(ForbiddenException);

    // A checagem de verificação acontece ANTES de qualquer outra coisa —
    // nem o carrinho/endereço/produto chegam a ser consultados.
    expect(produtosService.findOne).not.toHaveBeenCalled();
    expect(enderecosService.findOneForUsuario).not.toHaveBeenCalled();
    expect(pedidoCreate).not.toHaveBeenCalled();
  });

  it('I: usuário com e-mail confirmado consegue criar a sessão normalmente (gate não bloqueia quem já verificou)', async () => {
    const pedidoCreate = jest.fn(() => ({ id: 42, numero: 'PED-1' }));
    const pedidoUpdate = jest.fn();
    const enderecosService = { findOneForUsuario: jest.fn(() => ENDERECO_FAKE) };
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
      id: 'chk_verificado',
      link: 'https://sandbox.asaas.com/checkoutSession/show/chk_verificado',
      status: 'ACTIVE',
    }));
    const findOne = jest.fn(() => ({ emailVerificado: true }));

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
          useValue: { pedido: { create: pedidoCreate, update: pedidoUpdate } },
        },
        { provide: ProdutosService, useValue: produtosService },
        { provide: EnderecosService, useValue: enderecosService },
        { provide: AsaasService, useValue: { criarCheckout } },
        { provide: UsuariosService, useValue: { findOne } },
        { provide: MelhorEnvioService, useValue: melhorEnvioServiceComOpcoes() },
      ],
    }).compile();
    const service = module.get<CheckoutService>(CheckoutService);

    const resultado = await service.createSession(
      {
        itens: [{ produtoId: 5, quantidade: 1 }],
        clienteEmail: 'cliente@sensora.dev',
        clienteNome: 'Cliente',
        enderecoId: 1,
        freteServicoId: OPCAO_FRETE_FAKE.id,
      },
      7,
    );

    expect(findOne).toHaveBeenCalledWith(7);
    expect(resultado).toEqual({
      sessionId: 'chk_verificado',
      url: 'https://sandbox.asaas.com/checkoutSession/show/chk_verificado',
    });
  });
});

// Etapa 5B.6 — restauração de estoque após confirmação de reembolso
// (PAYMENT_REFUNDED). "Banco" fake com três partes vivas — pedidoFake,
// itensFake e produtosFake (Map produtoId -> quantidade) — para que o mock
// de `$transaction` consiga simular a garantia real do Postgres: TODAS as
// mutações feitas dentro do callback (tanto `tx.itemPedido.updateMany`
// quanto `produtosService.adicionarEstoque`, que aqui grava direto em
// `produtosFake`) são tiradas de um snapshot ANTES do callback rodar e
// só ficam confirmadas se o callback resolver sem lançar — se lançar, o
// snapshot é restaurado por inteiro (rollback), exatamente como a
// Etapa 5A.2 já assume para `confirmarPagamento`. Essa simulação prova a
// LÓGICA de tudo-ou-nada do código (item 13 da etapa); não substitui um
// teste de integração contra Postgres real para a garantia de lock de
// linha em si (ver teste K).
describe('CheckoutService — restauração de estoque após reembolso (Etapa 5B.6)', () => {
  let service: CheckoutService;
  let prisma: {
    pedido: { findUnique: jest.Mock; updateMany: jest.Mock };
    itemPedido: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let produtosService: { adicionarEstoque: jest.Mock };

  let pedidoFake: {
    id: number;
    asaasPaymentId: string | null;
    status: StatusPedido;
  };
  let itensFake: {
    id: number;
    pedidoId: number;
    produtoId: number;
    quantidade: number;
    estoqueBaixado: boolean | null;
    estoqueRestaurado: boolean;
  }[];
  let produtosFake: Map<number, number>;
  let falharAdicionarEstoquePara: number | null;

  function construirEventoPaymentRefunded(paymentId: string): string {
    return JSON.stringify({
      id: `evt_${paymentId}`,
      event: 'PAYMENT_REFUNDED',
      payment: { id: paymentId, status: 'CONFIRMED' },
    });
  }

  async function enviarPaymentRefunded(): Promise<{ received: boolean }> {
    return service.handleWebhook(
      { asaasAccessToken: ASAAS_WEBHOOK_TOKEN },
      Buffer.from(construirEventoPaymentRefunded('pay_123')),
    );
  }

  beforeEach(async () => {
    pedidoFake = {
      id: 1,
      asaasPaymentId: 'pay_123',
      status: StatusPedido.REEMBOLSO_SOLICITADO,
    };
    itensFake = [];
    produtosFake = new Map();
    falharAdicionarEstoquePara = null;

    prisma = {
      pedido: {
        findUnique: jest.fn(
          ({ where }: { where: { asaasPaymentId: string } }) =>
            where.asaasPaymentId === pedidoFake.asaasPaymentId
              ? { ...pedidoFake }
              : null,
        ),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: number; status: StatusPedido };
            data: { status: StatusPedido };
          }) => {
            if (where.id === pedidoFake.id && where.status === pedidoFake.status) {
              pedidoFake.status = data.status;
              return { count: 1 };
            }
            return { count: 0 };
          },
        ),
      },
      itemPedido: {
        findMany: jest.fn(({ where }: { where: { pedidoId: number } }) =>
          itensFake
            .filter((item) => item.pedidoId === where.pedidoId)
            .map((item) => ({ ...item })),
        ),
      },
      // Ver comentário do describe: snapshot/restore em torno do callback
      // simula a garantia tudo-ou-nada do Postgres para efeito de testar a
      // LÓGICA (item 13); o claim condicional em si (WHERE estoqueBaixado/
      // estoqueRestaurado) roda de verdade dentro de `tx.itemPedido.updateMany`
      // abaixo, contra o mesmo `itensFake` mutável.
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const snapshotItens = itensFake.map((item) => ({ ...item }));
          const snapshotProdutos = new Map(produtosFake);
          const tx = {
            itemPedido: {
              updateMany: jest.fn(
                ({
                  where,
                  data,
                }: {
                  where: {
                    id: number;
                    estoqueBaixado: boolean;
                    estoqueRestaurado: boolean;
                  };
                  data: { estoqueRestaurado: boolean };
                }) => {
                  const item = itensFake.find((i) => i.id === where.id);
                  if (
                    item &&
                    item.estoqueBaixado === where.estoqueBaixado &&
                    item.estoqueRestaurado === where.estoqueRestaurado
                  ) {
                    item.estoqueRestaurado = data.estoqueRestaurado;
                    return { count: 1 };
                  }
                  return { count: 0 };
                },
              ),
            },
          };

          try {
            return await callback(tx);
          } catch (erro) {
            itensFake.length = 0;
            itensFake.push(...snapshotItens);
            produtosFake.clear();
            for (const [produtoId, quantidade] of snapshotProdutos) {
              produtosFake.set(produtoId, quantidade);
            }
            throw erro;
          }
        },
      ),
    };

    produtosService = {
      adicionarEstoque: jest.fn(
        async (produtoId: number, quantidade: number) => {
          if (falharAdicionarEstoquePara === produtoId) {
            throw new Error('Falha simulada no incremento de estoque');
          }
          produtosFake.set(
            produtoId,
            (produtosFake.get(produtoId) ?? 0) + quantidade,
          );
          return {};
        },
      ),
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
        { provide: UsuariosService, useValue: {} },
        { provide: MelhorEnvioService, useValue: {} },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  // A
  it('A: restaura o estoque de um item elegível e mantém REEMBOLSADO', async () => {
    itensFake = [
      {
        id: 10,
        pedidoId: 1,
        produtoId: 100,
        quantidade: 3,
        estoqueBaixado: true,
        estoqueRestaurado: false,
      },
    ];
    produtosFake.set(100, 5);

    await enviarPaymentRefunded();

    expect(pedidoFake.status).toBe(StatusPedido.REEMBOLSADO);
    expect(itensFake[0].estoqueRestaurado).toBe(true);
    expect(produtosFake.get(100)).toBe(8);
  });

  // B
  it('B: webhook PAYMENT_REFUNDED duplicado só incrementa o estoque uma vez', async () => {
    itensFake = [
      {
        id: 10,
        pedidoId: 1,
        produtoId: 100,
        quantidade: 3,
        estoqueBaixado: true,
        estoqueRestaurado: false,
      },
    ];
    produtosFake.set(100, 5);

    await enviarPaymentRefunded();
    await enviarPaymentRefunded();

    expect(produtosFake.get(100)).toBe(8);
    expect(itensFake[0].estoqueRestaurado).toBe(true);
    expect(produtosService.adicionarEstoque).toHaveBeenCalledTimes(1);
  });

  // C
  it('C: item já restaurado não gera novo incremento', async () => {
    itensFake = [
      {
        id: 10,
        pedidoId: 1,
        produtoId: 100,
        quantidade: 3,
        estoqueBaixado: true,
        estoqueRestaurado: true,
      },
    ];
    produtosFake.set(100, 5);

    await enviarPaymentRefunded();

    expect(produtosFake.get(100)).toBe(5);
    expect(produtosService.adicionarEstoque).not.toHaveBeenCalled();
  });

  // D
  it('D: item com estoqueBaixado=false nunca incrementa estoque', async () => {
    itensFake = [
      {
        id: 10,
        pedidoId: 1,
        produtoId: 100,
        quantidade: 3,
        estoqueBaixado: false,
        estoqueRestaurado: false,
      },
    ];
    produtosFake.set(100, 5);

    await enviarPaymentRefunded();

    expect(produtosFake.get(100)).toBe(5);
    expect(itensFake[0].estoqueRestaurado).toBe(false);
    expect(produtosService.adicionarEstoque).not.toHaveBeenCalled();
  });

  // E
  it('E: item com estoqueBaixado=null não é restaurado automaticamente e gera warning', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    itensFake = [
      {
        id: 10,
        pedidoId: 1,
        produtoId: 100,
        quantidade: 3,
        estoqueBaixado: null,
        estoqueRestaurado: false,
      },
    ];
    produtosFake.set(100, 5);

    await enviarPaymentRefunded();

    expect(produtosFake.get(100)).toBe(5);
    expect(itensFake[0].estoqueRestaurado).toBe(false);
    expect(produtosService.adicionarEstoque).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('indeterminado'),
    );
    warnSpy.mockRestore();
  });

  // F
  it('F: pedido com múltiplos itens só restaura os elegíveis', async () => {
    itensFake = [
      {
        id: 1,
        pedidoId: 1,
        produtoId: 100,
        quantidade: 2,
        estoqueBaixado: true,
        estoqueRestaurado: false,
      },
      {
        id: 2,
        pedidoId: 1,
        produtoId: 200,
        quantidade: 5,
        estoqueBaixado: true,
        estoqueRestaurado: false,
      },
      {
        id: 3,
        pedidoId: 1,
        produtoId: 300,
        quantidade: 10,
        estoqueBaixado: false,
        estoqueRestaurado: false,
      },
    ];
    produtosFake.set(100, 0);
    produtosFake.set(200, 0);
    produtosFake.set(300, 0);

    await enviarPaymentRefunded();

    expect(produtosFake.get(100)).toBe(2);
    expect(produtosFake.get(200)).toBe(5);
    expect(produtosFake.get(300)).toBe(0);
  });

  // G
  it('G: dois itens do mesmo produto somam corretamente (+5, não sobrescrevem)', async () => {
    itensFake = [
      {
        id: 1,
        pedidoId: 1,
        produtoId: 10,
        quantidade: 2,
        estoqueBaixado: true,
        estoqueRestaurado: false,
      },
      {
        id: 2,
        pedidoId: 1,
        produtoId: 10,
        quantidade: 3,
        estoqueBaixado: true,
        estoqueRestaurado: false,
      },
    ];
    produtosFake.set(10, 0);

    await enviarPaymentRefunded();

    expect(produtosFake.get(10)).toBe(5);
    expect(itensFake.every((item) => item.estoqueRestaurado)).toBe(true);
  });

  // H
  it('H: falha no incremento de um item reverte tudo (nenhum item fica parcialmente restaurado)', async () => {
    itensFake = [
      {
        id: 1,
        pedidoId: 1,
        produtoId: 10,
        quantidade: 2,
        estoqueBaixado: true,
        estoqueRestaurado: false,
      },
      {
        id: 2,
        pedidoId: 1,
        produtoId: 20,
        quantidade: 3,
        estoqueBaixado: true,
        estoqueRestaurado: false,
      },
    ];
    produtosFake.set(10, 0);
    produtosFake.set(20, 0);
    falharAdicionarEstoquePara = 20;

    await expect(enviarPaymentRefunded()).rejects.toThrow(
      'Falha simulada no incremento de estoque',
    );

    expect(itensFake[0].estoqueRestaurado).toBe(false);
    expect(itensFake[1].estoqueRestaurado).toBe(false);
    expect(produtosFake.get(10)).toBe(0);
    expect(produtosFake.get(20)).toBe(0);
  });

  // I
  it('I: retry depois da falha restaura o estoque exatamente uma vez', async () => {
    itensFake = [
      {
        id: 1,
        pedidoId: 1,
        produtoId: 10,
        quantidade: 4,
        estoqueBaixado: true,
        estoqueRestaurado: false,
      },
    ];
    produtosFake.set(10, 0);
    falharAdicionarEstoquePara = 10;

    await expect(enviarPaymentRefunded()).rejects.toThrow();
    expect(produtosFake.get(10)).toBe(0);
    expect(itensFake[0].estoqueRestaurado).toBe(false);
    // A transição de status já ocorre ANTES da restauração (item 4/14 da
    // etapa) — mesmo com a restauração falhando, o pedido já está
    // REEMBOLSADO após a 1ª tentativa; a 2ª chamada precisa reprocessar
    // mesmo assim, e é exatamente isso que este teste confirma.
    expect(pedidoFake.status).toBe(StatusPedido.REEMBOLSADO);

    falharAdicionarEstoquePara = null;
    await enviarPaymentRefunded();

    expect(produtosFake.get(10)).toBe(4);
    expect(itensFake[0].estoqueRestaurado).toBe(true);
    expect(produtosService.adicionarEstoque).toHaveBeenCalledTimes(2);
  });

  // J
  it('J: pedido já REEMBOLSADO com estoqueRestaurado=false ainda restaura o estoque', async () => {
    pedidoFake.status = StatusPedido.REEMBOLSADO;
    itensFake = [
      {
        id: 1,
        pedidoId: 1,
        produtoId: 10,
        quantidade: 7,
        estoqueBaixado: true,
        estoqueRestaurado: false,
      },
    ];
    produtosFake.set(10, 0);

    await enviarPaymentRefunded();

    expect(produtosFake.get(10)).toBe(7);
    expect(itensFake[0].estoqueRestaurado).toBe(true);
  });

  // K — concorrência: ver comentário do describe. O mock de
  // `$transaction`/`tx.itemPedido.updateMany` acima roda o MESMO claim
  // condicional (WHERE estoqueBaixado/estoqueRestaurado) que o código real
  // executa contra o Postgres; duas chamadas via Promise.all geram
  // interleaving genuíno de operações assíncronas (cada `await` cede o
  // event loop), então esta suíte prova que a LÓGICA do claim é
  // race-safe sob interleaving real do Node. NÃO é um teste de integração
  // contra Postgres — o lock de linha de verdade (que é o que impede as
  // duas transações de lerem `estoqueRestaurado=false` simultaneamente) só
  // existe num banco real. Não foi criado um teste de integração contra
  // banco de desenvolvimento nesta etapa por não haver, neste ambiente, uma
  // forma segura e confirmada de isolar essa gravação concorrente de uma
  // instância que não seja de produção — ver relatório final, item C.
  it('K: duas execuções concorrentes do webhook incrementam o estoque só uma vez', async () => {
    itensFake = [
      {
        id: 1,
        pedidoId: 1,
        produtoId: 10,
        quantidade: 6,
        estoqueBaixado: true,
        estoqueRestaurado: false,
      },
    ];
    produtosFake.set(10, 0);

    await Promise.all([enviarPaymentRefunded(), enviarPaymentRefunded()]);

    expect(produtosFake.get(10)).toBe(6);
    expect(produtosService.adicionarEstoque).toHaveBeenCalledTimes(1);
  });
});

// Etapa 6.5 (Frete), Parte 3/8 — POST /checkout/frete/cotacao
// (CheckoutService.cotarFrete). Testes A/B/C/E/J da etapa.
describe('CheckoutService — cotarFrete (Etapa 6.5)', () => {
  async function criarService(
    enderecosService: { findOneForUsuario: jest.Mock },
    produtosService: { findOne: jest.Mock },
    melhorEnvioService: unknown,
  ): Promise<CheckoutService> {
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
        { provide: PrismaService, useValue: {} },
        { provide: ProdutosService, useValue: produtosService },
        { provide: EnderecosService, useValue: enderecosService },
        { provide: AsaasService, useValue: {} },
        { provide: UsuariosService, useValue: {} },
        { provide: MelhorEnvioService, useValue: melhorEnvioService },
      ],
    }).compile();
    return module.get<CheckoutService>(CheckoutService);
  }

  // A
  it('A: cotação válida retorna as opções, com CEP de destino do endereço, peso escalado pela quantidade e valor declarado = subtotal real dos produtos', async () => {
    const enderecosService = { findOneForUsuario: jest.fn(() => ENDERECO_FAKE) };
    const produtosService = {
      findOne: jest.fn(() => ({ id: 5, preco: 10.5 })),
    };
    const melhorEnvioService = melhorEnvioServiceComOpcoes([
      OPCAO_FRETE_FAKE,
      { id: 2, transportadora: 'Jadlog', servico: '.Package', preco: 18, prazoDias: 5 },
    ]);

    const service = await criarService(
      enderecosService,
      produtosService,
      melhorEnvioService,
    );

    const resultado = await service.cotarFrete(
      { itens: [{ produtoId: 5, quantidade: 3 }], enderecoId: 1 },
      1,
    );

    expect(enderecosService.findOneForUsuario).toHaveBeenCalledWith(1, 1);
    expect(melhorEnvioService.cotar).toHaveBeenCalledWith({
      cepDestino: ENDERECO_FAKE.cep,
      pacote: { ...PACOTE_PADRAO_FAKE, pesoGramas: PACOTE_PADRAO_FAKE.pesoGramas * 3 },
      valorDeclarado: 31.5, // 10.5 * 3
    });
    expect(resultado).toEqual([
      OPCAO_FRETE_FAKE,
      { id: 2, transportadora: 'Jadlog', servico: '.Package', preco: 18, prazoDias: 5 },
    ]);
  });

  it('carrinho vazio: rejeita antes de consultar endereço ou o Melhor Envio', async () => {
    const enderecosService = { findOneForUsuario: jest.fn() };
    const produtosService = { findOne: jest.fn() };
    const melhorEnvioService = melhorEnvioServiceComOpcoes();

    const service = await criarService(
      enderecosService,
      produtosService,
      melhorEnvioService,
    );

    await expect(
      service.cotarFrete({ itens: [], enderecoId: 1 }, 1),
    ).rejects.toThrow(BadRequestException);
    expect(enderecosService.findOneForUsuario).not.toHaveBeenCalled();
    expect(melhorEnvioService.cotar).not.toHaveBeenCalled();
  });

  // E (variação para o endpoint de cotação): nenhuma opção disponível não é
  // um erro — devolve lista vazia, e é o frontend quem mostra o estado
  // "nenhuma opção disponível" (Parte 6 da etapa).
  it('nenhuma opção disponível: devolve lista vazia (não é erro)', async () => {
    const enderecosService = { findOneForUsuario: jest.fn(() => ENDERECO_FAKE) };
    const produtosService = { findOne: jest.fn(() => ({ id: 5, preco: 10.5 })) };
    const melhorEnvioService = melhorEnvioServiceComOpcoes([]);

    const service = await criarService(
      enderecosService,
      produtosService,
      melhorEnvioService,
    );

    const resultado = await service.cotarFrete(
      { itens: [{ produtoId: 5, quantidade: 1 }], enderecoId: 1 },
      1,
    );
    expect(resultado).toEqual([]);
  });

  // C: erro do Melhor Envio (fora do ar, recusado etc.) é propagado, nunca
  // silenciado como se fosse "nenhuma opção disponível".
  it('C: erro do Melhor Envio é propagado ao chamador, não é engolido como lista vazia', async () => {
    const enderecosService = { findOneForUsuario: jest.fn(() => ENDERECO_FAKE) };
    const produtosService = { findOne: jest.fn(() => ({ id: 5, preco: 10.5 })) };
    const melhorEnvioService = {
      cotar: jest.fn(() => {
        throw new BadGatewayException('O Melhor Envio recusou a cotação');
      }),
      pacotePadraoConfigurado: PACOTE_PADRAO_FAKE,
    };

    const service = await criarService(
      enderecosService,
      produtosService,
      melhorEnvioService,
    );

    await expect(
      service.cotarFrete(
        { itens: [{ produtoId: 5, quantidade: 1 }], enderecoId: 1 },
        1,
      ),
    ).rejects.toThrow(BadGatewayException);
  });

  // B (via ownership do endereço — mesmo mecanismo de proteção de
  // "CEP inválido"/endereço não pertencente ao cliente já usado em
  // createSession): endereço de outro usuário (ou inexistente) nunca chega
  // a consultar o Melhor Envio.
  it('B: endereço inexistente/de outro usuário é rejeitado antes de cotar', async () => {
    const enderecosService = {
      findOneForUsuario: jest.fn(() => {
        throw new NotFoundException('Endereço com id 999 não encontrado');
      }),
    };
    const produtosService = { findOne: jest.fn() };
    const melhorEnvioService = melhorEnvioServiceComOpcoes();

    const service = await criarService(
      enderecosService,
      produtosService,
      melhorEnvioService,
    );

    await expect(
      service.cotarFrete(
        { itens: [{ produtoId: 5, quantidade: 1 }], enderecoId: 999 },
        1,
      ),
    ).rejects.toThrow();
    expect(melhorEnvioService.cotar).not.toHaveBeenCalled();
  });
});
