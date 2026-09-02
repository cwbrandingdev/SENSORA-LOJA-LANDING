import {
  BadGatewayException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AsaasBillingType = 'PIX' | 'CREDIT_CARD';
export type AsaasChargeType = 'DETACHED' | 'RECURRENT' | 'INSTALLMENT';
export type AsaasCheckoutStatus = 'ACTIVE' | 'PAID' | 'EXPIRED' | 'CANCELED';

export interface AsaasCheckoutItem {
  name: string;
  quantity: number;
  value: number;
}

export interface CriarCheckoutPayload {
  billingTypes: AsaasBillingType[];
  chargeTypes: AsaasChargeType[];
  items: AsaasCheckoutItem[];
  callback: { successUrl: string; cancelUrl: string };
  externalReference: string;
}

export interface AsaasCheckout {
  id: string;
  link: string;
  status: AsaasCheckoutStatus;
  externalReference?: string | null;
}

// Etapa 5B.3 — status de Payment que nosso fluxo de reembolso precisa
// distinguir. A Asaas retorna outros valores (ex.: AWAITING_RISK_ANALYSIS,
// CHARGEBACK_REQUESTED) que não usamos ainda; mantido como string aberta
// (não union fechada) para não quebrar em valor inesperado do gateway.
export type AsaasPaymentStatus = string;

// Somente os campos do Payment realmente usados pelo fluxo de reembolso
// (resolução do Payment ligado a um Checkout, e status para reconciliação
// futura). Não é um espelho completo do objeto Payment da Asaas.
export interface AsaasPayment {
  id: string;
  status: AsaasPaymentStatus;
  value?: number;
  checkoutSession?: string | null;
  externalReference?: string | null;
}

interface AsaasPaymentListResponse {
  data: AsaasPayment[];
  totalCount?: number;
  hasMore?: boolean;
}

// Etapa 5B.3 — status de Refund conhecidos da Asaas. `DONE` é o único que
// representa dinheiro efetivamente devolvido (ver estornarPagamento/
// consultarEstornos) — todo o resto (incluindo valores futuros não
// previstos aqui) deve ser tratado como "não confirmado".
export type AsaasRefundStatus =
  | 'PENDING'
  | 'AWAITING_CRITICAL_ACTION_AUTHORIZATION'
  | 'DONE'
  | 'CANCELLED';

export interface AsaasRefund {
  id: string;
  status: AsaasRefundStatus;
  value: number;
  description?: string | null;
  dateCreated?: string;
  effectiveDate?: string | null;
  transactionReceiptUrl?: string | null;
}

interface AsaasRefundListResponse {
  data: AsaasRefund[];
  totalCount?: number;
  hasMore?: boolean;
}

// Resultado controlado de resolverPaymentIdPorCheckout — nunca lança para o
// caso "não encontrado" (esperado: checkout ainda não virou payment), só
// para inconsistência real (mais de um payment para o mesmo checkout).
export type ResolverPaymentResult =
  | { encontrado: true; payment: AsaasPayment }
  | { encontrado: false };

// Etapa 5B.3 — erros específicos do AsaasService, para que a camada de
// negócio futura (PedidosService) consiga distinguir os casos do item 7 do
// pedido da etapa por `instanceof`, sem depender de parsear mensagem. Todos
// estendem a exceção HTTP correspondente (mantém o mapeamento HTTP já usado
// pelos controllers), só adicionando uma classe própria para diferenciação.

// Falha de rede/timeout ao chamar o Asaas — a requisição pode ou não ter
// sido processada do lado deles. NUNCA equivale a "o Asaas recusou/o refund
// falhou": ver item 7 da etapa — timeout ≠ certeza de que o refund não foi
// criado. O chamador deve tratar isso como estado ambíguo, não como falha
// definitiva.
export class AsaasIndisponivelError extends BadGatewayException {}

// O Asaas respondeu, mas recusou a requisição (4xx/5xx que não seja o 404
// tratado como "não encontrado" por um método específico). Aqui SIM há
// certeza: a requisição foi recebida e rejeitada.
export class AsaasErroHttpError extends BadGatewayException {}

// HTTP 200/201 do Asaas, mas corpo que não é o JSON esperado — resposta
// inconsistente, não um erro de comunicação.
export class AsaasRespostaInvalidaError extends InternalServerErrorException {}

// Payment ou Refund não encontrado no Asaas (404 em endpoint que recebe um
// id específico, ex.: GET /payments/{id}/refunds ou POST
// /payments/{id}/refund com paymentId inexistente).
export class AsaasNaoEncontradoError extends NotFoundException {}

// resolverPaymentIdPorCheckout encontrou mais de um Payment para o mesmo
// Checkout — não há escolha correta possível, é inconsistência de dados a
// ser investigada manualmente, nunca resolvida arbitrariamente.
export class AsaasInconsistenciaError extends ConflictException {}

// Task 21 — cliente HTTP fino para o Asaas Checkout (API REST, sem SDK
// oficial em Node — usa fetch nativo, sem adicionar dependência nova). A
// ASAAS_API_KEY nunca aparece em mensagem de erro nem é logada: qualquer
// falha vira uma exceção genérica, o corpo da resposta de erro do Asaas
// (que pode ecoar dados da requisição) nunca é repassado ao chamador.
//
// ASAAS_API_KEY/ASAAS_BASE_URL só são obrigatórias no Joi quando
// CHECKOUT_GATEWAY="asaas" (ver app.module.ts) — mas este serviço é sempre
// instanciado pelo Nest, mesmo no modo de rollback ("stripe"), porque
// CheckoutModule sempre importa AsaasModule. Por isso a validação aqui é
// preguiçosa (mesmo padrão de ImagekitService): não lança no construtor,
// só quando efetivamente chamado sem estar configurado.
@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private readonly apiKey?: string;
  private readonly baseUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ASAAS_API_KEY');
    const baseUrl = this.configService.get<string>('ASAAS_BASE_URL');
    this.baseUrl = baseUrl?.replace(/\/+$/, '');
  }

  async criarCheckout(payload: CriarCheckoutPayload): Promise<AsaasCheckout> {
    return this.request('POST', '/checkouts', payload);
  }

  async consultarCheckout(id: string): Promise<AsaasCheckout> {
    return this.request('GET', `/checkouts/${encodeURIComponent(id)}`);
  }

  // Etapa 5B.3 — resolve o Payment real (pay_xxx) por trás de um Checkout
  // (chk_xxx): são ids de recursos DIFERENTES na Asaas — o Checkout nunca é
  // aceito onde a API espera um Payment (ex.: /payments/{id}/refund). Só
  // recebe o checkoutId internamente (nunca um endpoint público expõe este
  // método) — quem decide qual pedido/checkout consultar é a camada de
  // negócio (PedidosService), não o cliente.
  async resolverPaymentIdPorCheckout(
    asaasCheckoutId: string,
  ): Promise<ResolverPaymentResult> {
    const resposta = await this.request<AsaasPaymentListResponse>(
      'GET',
      `/payments?checkoutSession=${encodeURIComponent(asaasCheckoutId)}`,
    );

    const payments = resposta.data ?? [];

    if (payments.length === 0) {
      return { encontrado: false };
    }

    if (payments.length > 1) {
      // Nunca escolher arbitrariamente (item 2 da etapa) — mais de um
      // Payment para o mesmo Checkout é inconsistência de dados, não um
      // caso de negócio esperado.
      this.logger.error(
        `Mais de um Payment encontrado para o checkoutSession ${asaasCheckoutId}: ${payments
          .map((p) => p.id)
          .join(', ')}`,
      );
      throw new AsaasInconsistenciaError(
        'Mais de um Payment encontrado para o Checkout informado',
      );
    }

    return { encontrado: true, payment: payments[0] };
  }

  // Etapa 5B.3 — lista os refunds já existentes para um Payment, preservando
  // os campos necessários para reconciliação futura (não simplifica para só
  // um booleano/estado). Usado pela camada de negócio futura para decidir,
  // antes de chamar estornarPagamento, se já existe um refund válido (item 8
  // da etapa) — essa decisão NÃO é tomada aqui.
  async consultarEstornos(paymentId: string): Promise<AsaasRefund[]> {
    const resposta = await this.request<AsaasRefundListResponse>(
      'GET',
      `/payments/${encodeURIComponent(paymentId)}/refunds`,
      undefined,
      { mensagemNaoEncontrado: 'Payment não encontrado no Asaas' },
    );

    return resposta.data ?? [];
  }

  // Etapa 5B.3 — solicita reembolso TOTAL do Payment. Recebe só paymentId
  // (resolvido internamente pelo backend, nunca pelo frontend) e uma
  // descrição interna opcional — nunca `value` (item 4 da etapa: reembolso
  // parcial fica fora do MVP, e valor nunca vem do cliente).
  //
  // HTTP 200 aqui significa só que a Asaas ACEITOU a solicitação — não que o
  // dinheiro já voltou. O status real do refund retornado (`DONE` vs
  // `PENDING`/outro) é quem determina isso, e cabe ao chamador (item 5 da
  // etapa) interpretar o campo `status` do retorno — este método não decide
  // isso por ele.
  async estornarPagamento(
    paymentId: string,
    description?: string,
  ): Promise<AsaasRefund> {
    return this.request<AsaasRefund>(
      'POST',
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      description ? { description } : {},
      { mensagemNaoEncontrado: 'Payment não encontrado no Asaas' },
    );
  }

  private async request<T = AsaasCheckout>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    opcoes?: { mensagemNaoEncontrado?: string },
  ): Promise<T> {
    if (!this.apiKey || !this.baseUrl) {
      throw new InternalServerErrorException(
        'ASAAS_API_KEY/ASAAS_BASE_URL não configuradas',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          access_token: this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      // Item 7 da etapa: falha de rede/timeout NUNCA vira o mesmo tipo de
      // erro de "o Asaas recusou" (AsaasErroHttpError) — é uma classe
      // própria (AsaasIndisponivelError) justamente para o chamador futuro
      // conseguir tratar como estado ambíguo (a requisição pode ou não ter
      // chegado a processar do lado da Asaas).
      throw new AsaasIndisponivelError(
        'Não foi possível se comunicar com o Asaas',
      );
    }

    if (response.status === 404 && opcoes?.mensagemNaoEncontrado) {
      throw new AsaasNaoEncontradoError(opcoes.mensagemNaoEncontrado);
    }

    if (!response.ok) {
      // Diagnóstico temporário (Task 21 — investigação do checkout
      // recusado): só no log do servidor, nunca repassado ao chamador —
      // status/corpo do Asaas ajudam a achar o motivo real da recusa sem
      // vazar nada sensível (API key/token nunca entram aqui, corpo é só o
      // que o Asaas devolveu sobre a própria requisição).
      const corpoErro = await response.text().catch(() => '<corpo ilegível>');
      this.logger.error(
        `Asaas recusou ${method} ${path} -> ${response.status} ${response.statusText}: ${corpoErro}`,
      );
      throw new AsaasErroHttpError('O Asaas recusou a requisição');
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new AsaasRespostaInvalidaError('Resposta inválida do Asaas');
    }
  }
}
