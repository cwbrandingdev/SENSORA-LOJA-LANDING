import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsaasService } from './asaas.service';

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
      json: () =>
        Promise.resolve({ errors: [{ description: 'detalhe interno' }] }),
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
});
