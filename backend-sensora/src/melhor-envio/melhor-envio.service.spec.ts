import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MelhorEnvioErroHttpError,
  MelhorEnvioIndisponivelError,
  MelhorEnvioNaoConectadoError,
  MelhorEnvioService,
} from './melhor-envio.service';

// Etapa 6.5 (Frete) — mesmo padrão de teste de AsaasService: `fetch` global
// é mockado (sem chamada de rede real), a única coisa exercitada de verdade
// é a LÓGICA do serviço (renovação de token, montagem do payload de
// cotação, tratamento de erro). O fluxo "authorize" em si (consentimento no
// navegador do dono da conta Melhor Envio) não é testável aqui — só a parte
// que roda no backend (geração/validação de `state`, troca do `code` por
// token) é.

const CONFIG_VALORES: Record<string, string> = {
  MELHOR_ENVIO_ENV: 'sandbox',
  MELHOR_ENVIO_CLIENT_ID: 'client-id-teste',
  MELHOR_ENVIO_CLIENT_SECRET: 'client-secret-teste',
  MELHOR_ENVIO_REDIRECT_URI: 'http://localhost:3000/admin/melhor-envio/callback',
  MELHOR_ENVIO_USER_AGENT: 'Sensora (contato@sensora.dev)',
  MELHOR_ENVIO_CEP_ORIGEM: '80000-000',
};

async function criarService(
  configValores: Record<string, string> = CONFIG_VALORES,
): Promise<{ service: MelhorEnvioService; prisma: { melhorEnvioToken: Record<string, jest.Mock> } }> {
  const prisma = {
    melhorEnvioToken: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MelhorEnvioService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => configValores[key] },
      },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();

  return { service: module.get(MelhorEnvioService), prisma };
}

function mockFetchOnce(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return jest.fn().mockResolvedValueOnce({
    ok,
    status,
    statusText: ok ? 'OK' : 'Erro',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response);
}

describe('MelhorEnvioService — OAuth2', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('gerarUrlAutorizacao monta a URL do sandbox com client_id/redirect_uri/state', async () => {
    const { service } = await criarService();
    const url = new URL(service.gerarUrlAutorizacao());

    expect(url.origin).toBe('https://sandbox.melhorenvio.com.br');
    expect(url.pathname).toBe('/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-id-teste');
    expect(url.searchParams.get('redirect_uri')).toBe(
      CONFIG_VALORES.MELHOR_ENVIO_REDIRECT_URI,
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toHaveLength(48);
  });

  it('URL de autorização usa o domínio de produção quando MELHOR_ENVIO_ENV=production', async () => {
    const { service } = await criarService({
      ...CONFIG_VALORES,
      MELHOR_ENVIO_ENV: 'production',
    });
    const url = new URL(service.gerarUrlAutorizacao());
    expect(url.origin).toBe('https://melhorenvio.com.br');
  });

  it('trocarCodigoPorToken com state inválido é rejeitado, nunca chama o Melhor Envio', async () => {
    const { service } = await criarService();
    service.gerarUrlAutorizacao(); // gera e guarda um state válido
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      service.trocarCodigoPorToken('codigo-qualquer', 'state-forjado'),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trocarCodigoPorToken com state correto troca o code por token e persiste no banco', async () => {
    const { service, prisma } = await criarService();
    const url = new URL(service.gerarUrlAutorizacao());
    const state = url.searchParams.get('state')!;

    global.fetch = mockFetchOnce(200, {
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_in: 3600,
    }) as unknown as typeof fetch;
    prisma.melhorEnvioToken.upsert.mockResolvedValueOnce({});

    await service.trocarCodigoPorToken('codigo-valido', state);

    expect(prisma.melhorEnvioToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        create: expect.objectContaining({
          accessToken: 'access-123',
          refreshToken: 'refresh-123',
        }),
        update: expect.objectContaining({
          accessToken: 'access-123',
          refreshToken: 'refresh-123',
        }),
      }),
    );
  });

  it('mesmo state não pode ser reutilizado (uso único)', async () => {
    const { service } = await criarService();
    const url = new URL(service.gerarUrlAutorizacao());
    const state = url.searchParams.get('state')!;

    global.fetch = mockFetchOnce(200, {
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
    }) as unknown as typeof fetch;
    await service.trocarCodigoPorToken('codigo-1', state);

    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      service.trocarCodigoPorToken('codigo-2', state),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('credenciais ausentes: gerarUrlAutorizacao falha cedo, sem tentar nenhuma chamada', async () => {
    const { service } = await criarService({ MELHOR_ENVIO_ENV: 'sandbox' });
    expect(() => service.gerarUrlAutorizacao()).toThrow(
      InternalServerErrorException,
    );
  });

  it('estaConectado reflete a existência (ou não) do token no banco', async () => {
    const { service, prisma } = await criarService();

    prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce(null);
    await expect(service.estaConectado()).resolves.toBe(false);

    prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce({ id: 1 });
    await expect(service.estaConectado()).resolves.toBe(true);
  });
});

describe('MelhorEnvioService — cotar (Etapa 6.5, Parte 3)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const PACOTE = { alturaCm: 10, larguraCm: 15, comprimentoCm: 20, pesoGramas: 900 };

  it('sem conexão prévia (nenhum token salvo): rejeita com MelhorEnvioNaoConectadoError, nunca chama a API de cotação', async () => {
    const { service, prisma } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce(null);
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      service.cotar({ cepDestino: '20040-020', pacote: PACOTE, valorDeclarado: 100 }),
    ).rejects.toThrow(MelhorEnvioNaoConectadoError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('token válido (não expirado): usa direto, sem chamar /oauth/token de novo', async () => {
    const { service, prisma } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: 'access-valido',
      refreshToken: 'refresh-valido',
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });

    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 1,
          name: 'PAC',
          price: '23.50',
          delivery_time: 9,
          company: { id: 1, name: 'Correios' },
        },
      ],
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const resultado = await service.cotar({
      cepDestino: '20040-020',
      pacote: PACOTE,
      valorDeclarado: 100,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1); // só /shipment/calculate, sem refresh
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer access-valido' }),
    );
    expect(resultado).toEqual([
      { id: 1, transportadora: 'Correios', servico: 'PAC', preco: 23.5, prazoDias: 9 },
    ]);
  });

  it('token expirado: renova via refresh_token ANTES de cotar, e persiste o novo token', async () => {
    const { service, prisma } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: 'access-velho',
      refreshToken: 'refresh-velho',
      expiresAt: new Date(Date.now() - 60_000), // já expirado
    });
    prisma.melhorEnvioToken.upsert.mockResolvedValueOnce({});

    const fetchMock = jest
      .fn()
      // 1ª chamada: POST /oauth/token (refresh)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'access-novo',
          refresh_token: 'refresh-novo',
          expires_in: 3600,
        }),
      } as unknown as Response)
      // 2ª chamada: POST /shipment/calculate
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await service.cotar({ cepDestino: '20040-020', pacote: PACOTE, valorDeclarado: 100 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/oauth/token');
    expect(fetchMock.mock.calls[1][0]).toContain('/shipment/calculate');
    expect(prisma.melhorEnvioToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ accessToken: 'access-novo' }),
      }),
    );
    // A segunda chamada (cotação) já usa o token renovado, não o antigo.
    const headersCotacao = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headersCotacao.Authorization).toBe('Bearer access-novo');
  });

  it('Melhor Envio recusa a cotação (4xx/5xx): propaga MelhorEnvioErroHttpError', async () => {
    const { service, prisma } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: 'access-valido',
      refreshToken: 'refresh-valido',
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: async () => '{"message":"CEP inválido"}',
    } as unknown as Response) as unknown as typeof fetch;

    await expect(
      service.cotar({ cepDestino: 'cep-invalido', pacote: PACOTE, valorDeclarado: 100 }),
    ).rejects.toThrow(MelhorEnvioErroHttpError);
  });

  it('falha de rede/timeout: propaga MelhorEnvioIndisponivelError (distinto de recusa HTTP)', async () => {
    const { service, prisma } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: 'access-valido',
      refreshToken: 'refresh-valido',
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNRESET')) as unknown as typeof fetch;

    await expect(
      service.cotar({ cepDestino: '20040-020', pacote: PACOTE, valorDeclarado: 100 }),
    ).rejects.toThrow(MelhorEnvioIndisponivelError);
  });

  it('item de cotação com erro (rota indisponível para aquela transportadora) é filtrado, não quebra a lista', async () => {
    const { service, prisma } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: 'access-valido',
      refreshToken: 'refresh-valido',
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 1,
          name: 'PAC',
          price: '23.50',
          delivery_time: 9,
          company: { id: 1, name: 'Correios' },
        },
        {
          id: 2,
          name: 'SEDEX',
          error: 'Serviço indisponível para o CEP informado',
        },
      ],
    } as unknown as Response) as unknown as typeof fetch;

    const resultado = await service.cotar({
      cepDestino: '20040-020',
      pacote: PACOTE,
      valorDeclarado: 100,
    });

    expect(resultado).toEqual([
      { id: 1, transportadora: 'Correios', servico: 'PAC', preco: 23.5, prazoDias: 9 },
    ]);
  });

  // I — credenciais/tokens nunca aparecem no que o CheckoutController acaba
  // devolvendo ao cliente: `cotar()` só devolve os 5 campos de
  // MelhorEnvioOpcao (id/transportadora/servico/preco/prazoDias), nunca o
  // access_token usado para chamar a API nem qualquer outro campo cru da
  // resposta do Melhor Envio.
  it('I: a opção retornada nunca inclui o access_token nem qualquer campo além de id/transportadora/servico/preco/prazoDias', async () => {
    const { service, prisma } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: 'segredo-nao-pode-vazar',
      refreshToken: 'refresh-valido',
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 1,
          name: 'PAC',
          price: '23.50',
          delivery_time: 9,
          company: { id: 1, name: 'Correios' },
          // Campos extras que a API real do Melhor Envio pode devolver —
          // nenhum deles deve sobreviver ao mapeamento.
          token: 'segredo-nao-pode-vazar',
          packages: [{ price: '23.50' }],
        },
      ],
    } as unknown as Response) as unknown as typeof fetch;

    const resultado = await service.cotar({
      cepDestino: '20040-020',
      pacote: PACOTE,
      valorDeclarado: 100,
    });

    expect(resultado).toEqual([
      { id: 1, transportadora: 'Correios', servico: 'PAC', preco: 23.5, prazoDias: 9 },
    ]);
    expect(JSON.stringify(resultado)).not.toContain('segredo-nao-pode-vazar');
  });
});
