import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AsaasErroHttpError,
  AsaasIndisponivelError,
  AsaasInconsistenciaError,
  AsaasNaoEncontradoError,
  AsaasService,
} from './asaas.service';

// Task 21 — testa só a camada HTTP fina (fetch mockado): sucesso, erro HTTP
// do Asaas, e falha de rede. Não faz nenhuma chamada de rede real.
describe('AsaasService', () => {
  const API_KEY = 'asaas_test_fake_nao_faz_chamada_de_rede';
  const BASE_URL = 'https://api-sandbox.asaas.com/v3';
  let fetchMock: jest.Mock;
  let service: AsaasService;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

    const configValues: Record<string, string> = {
      ASAAS_API_KEY: API_KEY,
      ASAAS_BASE_URL: BASE_URL,
    };
    service = new AsaasService({
      get: (key: string) => configValues[key],
    } as unknown as ConfigService);
  });

  it('não configurado (ex.: CHECKOUT_GATEWAY="stripe" sem ASAAS_*): lança ao ser chamado, não no construtor', async () => {
    const semConfig = new AsaasService({
      get: () => undefined,
    } as unknown as ConfigService);

    await expect(semConfig.consultarCheckout('chk_123')).rejects.toThrow(
      'ASAAS_API_KEY/ASAAS_BASE_URL não configuradas',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('criarCheckout: POST /checkouts com access_token e corpo corretos', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'chk_123',
          link: 'https://sandbox.asaas.com/checkoutSession/show/chk_123',
          status: 'ACTIVE',
        }),
    });

    const resultado = await service.criarCheckout({
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['DETACHED'],
      items: [{ name: 'Vela', quantity: 1, value: 39.9 }],
      callback: {
        successUrl: 'http://localhost:3001/checkout/sucesso',
        cancelUrl: 'http://localhost:3001/checkout/cancelado',
      },
      externalReference: '1',
    });

    expect(resultado).toEqual({
      id: 'chk_123',
      link: 'https://sandbox.asaas.com/checkoutSession/show/chk_123',
      status: 'ACTIVE',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/checkouts`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).access_token).toBe(API_KEY);
  });

  it('consultarCheckout: GET /checkouts/:id', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ id: 'chk_123', link: 'https://x', status: 'PAID' }),
    });

    const resultado = await service.consultarCheckout('chk_123');

    expect(resultado.status).toBe('PAID');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/checkouts/chk_123`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('resposta não-OK do Asaas: lança BadGatewayException sem repassar o corpo do erro', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      // Correção da infraestrutura de testes — este mock só tinha `json`,
      // mas o código de produção (AsaasService.request, não-ok) lê o corpo
      // do erro via `response.text()` (só para log de diagnóstico, nunca
      // repassado ao chamador) desde a Task 21. Sem `text`, a chamada real
      // quebrava com `TypeError: response.text is not a function` — mascarado
      // até agora pelo Jest carregar o `.js` obsoleto em vez do `.ts` real.
      text: () =>
        Promise.resolve(
          JSON.stringify({ errors: [{ description: 'detalhe interno' }] }),
        ),
    });

    await expect(service.consultarCheckout('chk_123')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('falha de rede: lança BadGatewayException', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(service.consultarCheckout('chk_123')).rejects.toThrow(
      BadGatewayException,
    );
  });

  // Etapa 5B.3 — resolverPaymentIdPorCheckout, consultarEstornos e
  // estornarPagamento (item 10 da etapa).
  describe('resolverPaymentIdPorCheckout', () => {
    it('um resultado: retorna o Payment encontrado', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [{ id: 'pay_123', status: 'CONFIRMED', value: 39.9 }],
          }),
      });

      const resultado = await service.resolverPaymentIdPorCheckout('chk_123');

      expect(resultado).toEqual({
        encontrado: true,
        payment: { id: 'pay_123', status: 'CONFIRMED', value: 39.9 },
      });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        `${BASE_URL}/payments?checkoutSession=chk_123`,
      );
      expect(init.method).toBe('GET');
    });

    it('nenhum resultado: retorna { encontrado: false } sem inventar Payment', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      });

      const resultado = await service.resolverPaymentIdPorCheckout('chk_123');

      expect(resultado).toEqual({ encontrado: false });
    });

    it('mais de um resultado: lança erro controlado de inconsistência', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [
              { id: 'pay_123', status: 'CONFIRMED' },
              { id: 'pay_456', status: 'CONFIRMED' },
            ],
          }),
      });

      await expect(
        service.resolverPaymentIdPorCheckout('chk_123'),
      ).rejects.toThrow(AsaasInconsistenciaError);
    });
  });

  describe('consultarEstornos', () => {
    it('retorna a lista de refunds preservando os campos de reconciliação', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'ref_123',
                status: 'DONE',
                value: 39.9,
                description: 'Reembolso total',
                dateCreated: '2026-09-01',
              },
            ],
          }),
      });

      const resultado = await service.consultarEstornos('pay_123');

      expect(resultado).toEqual([
        {
          id: 'ref_123',
          status: 'DONE',
          value: 39.9,
          description: 'Reembolso total',
          dateCreated: '2026-09-01',
        },
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/payments/pay_123/refunds`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('payment não encontrado (404): lança AsaasNaoEncontradoError', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('{"errors":[]}'),
      });

      await expect(service.consultarEstornos('pay_inexistente')).rejects.toThrow(
        AsaasNaoEncontradoError,
      );
    });
  });

  describe('estornarPagamento', () => {
    it('solicita reembolso total (sem value) e retorna o refund', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 'ref_123',
            status: 'PENDING',
            value: 39.9,
          }),
      });

      const resultado = await service.estornarPagamento(
        'pay_123',
        'Cancelamento a pedido do cliente',
      );

      expect(resultado).toEqual({
        id: 'ref_123',
        status: 'PENDING',
        value: 39.9,
      });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/payments/pay_123/refund`);
      expect(init.method).toBe('POST');
      const corpo = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(corpo).toEqual({ description: 'Cancelamento a pedido do cliente' });
      expect(corpo.value).toBeUndefined();
    });

    it('HTTP 200 com status PENDING não deve ser interpretado como concluído pelo chamador', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ id: 'ref_123', status: 'PENDING', value: 39.9 }),
      });

      const resultado = await service.estornarPagamento('pay_123');

      expect(resultado.status).toBe('PENDING');
      expect(resultado.status).not.toBe('DONE');
    });

    it('payment não encontrado (404): lança AsaasNaoEncontradoError', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('{"errors":[]}'),
      });

      await expect(
        service.estornarPagamento('pay_inexistente'),
      ).rejects.toThrow(AsaasNaoEncontradoError);
    });

    it('erro HTTP do Asaas (não 404): lança AsaasErroHttpError, subclasse de BadGatewayException', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"errors":[{"description":"invalido"}]}'),
      });

      await expect(service.estornarPagamento('pay_123')).rejects.toThrow(
        AsaasErroHttpError,
      );
      await expect(service.estornarPagamento('pay_123')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('timeout/erro de rede: lança AsaasIndisponivelError, nunca é tratado como sucesso', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ETIMEDOUT'));

      await expect(service.estornarPagamento('pay_123')).rejects.toThrow(
        AsaasIndisponivelError,
      );
    });
  });
});
