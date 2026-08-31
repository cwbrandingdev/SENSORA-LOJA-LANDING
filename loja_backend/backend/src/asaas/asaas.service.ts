import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
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

  private async request<T = AsaasCheckout>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
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
      throw new BadGatewayException(
        'Não foi possível se comunicar com o Asaas',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException('O Asaas recusou a requisição de checkout');
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new InternalServerErrorException('Resposta inválida do Asaas');
    }
  }
}
