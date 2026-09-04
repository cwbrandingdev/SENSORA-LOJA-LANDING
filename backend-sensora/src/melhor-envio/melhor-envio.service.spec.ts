import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MelhorEnvioTokenCryptoService } from './melhor-envio-token-crypto.service';
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
//
// Etapa 8.4 (achado HIGH — tokens em texto puro) — MelhorEnvioTokenCryptoService
// NUNCA é mockado aqui: é a instância REAL (com uma chave de teste válida),
// para que os testes de persistência/leitura exercitem a criptografia de
// verdade, não uma simulação dela. `prisma.melhorEnvioToken` continua
// mockado (sem banco real) — quem lê/escreve um "MelhorEnvioToken" fake
// nos testes é sempre quem monta o mock de findUnique/upsert.

const CHAVE_CRIPTOGRAFIA_TESTE = randomBytes(32).toString('base64');

const CONFIG_VALORES: Record<string, string> = {
  MELHOR_ENVIO_ENV: 'sandbox',
  MELHOR_ENVIO_CLIENT_ID: 'client-id-teste',
  MELHOR_ENVIO_CLIENT_SECRET: 'client-secret-teste',
  MELHOR_ENVIO_REDIRECT_URI: 'http://localhost:3000/admin/melhor-envio/callback',
  MELHOR_ENVIO_USER_AGENT: 'Sensora (contato@sensora.dev)',
  MELHOR_ENVIO_CEP_ORIGEM: '80000-000',
  MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY: CHAVE_CRIPTOGRAFIA_TESTE,
};

async function criarService(
  configValores: Record<string, string> = CONFIG_VALORES,
): Promise<{
  service: MelhorEnvioService;
  prisma: { melhorEnvioToken: Record<string, jest.Mock> };
  tokenCrypto: MelhorEnvioTokenCryptoService;
}> {
  const prisma = {
    melhorEnvioToken: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MelhorEnvioService,
      MelhorEnvioTokenCryptoService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => configValores[key] },
      },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();

  return {
    service: module.get(MelhorEnvioService),
    prisma,
    tokenCrypto: module.get(MelhorEnvioTokenCryptoService),
  };
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

  // Caso G/H (Etapa 8.4) — o valor persistido nunca é o token OAuth em
  // texto puro: é o ciphertext AES-256-GCM (formato "v1:..."), e
  // descriptografá-lo de volta (leitura pelo serviço de criptografia, não
  // um atalho manual) devolve exatamente o token original que a API do
  // Melhor Envio enviou.
  it('trocarCodigoPorToken com state correto troca o code por token e persiste CRIPTOGRAFADO no banco (nunca em texto puro)', async () => {
    const { service, prisma, tokenCrypto } = await criarService();
    const url = new URL(service.gerarUrlAutorizacao());
    const state = url.searchParams.get('state')!;

    global.fetch = mockFetchOnce(200, {
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_in: 3600,
    }) as unknown as typeof fetch;
    prisma.melhorEnvioToken.upsert.mockResolvedValueOnce({});

    await service.trocarCodigoPorToken('codigo-valido', state);

    expect(prisma.melhorEnvioToken.upsert).toHaveBeenCalledTimes(1);
    const chamada = prisma.melhorEnvioToken.upsert.mock.calls[0][0] as {
      where: unknown;
      create: { accessToken: string; refreshToken: string };
      update: { accessToken: string; refreshToken: string };
    };

    expect(chamada.where).toEqual({ id: 1 });
    // Nunca o valor em texto puro — nem em create nem em update.
    expect(chamada.create.accessToken).not.toBe('access-123');
    expect(chamada.create.refreshToken).not.toBe('refresh-123');
    expect(chamada.update.accessToken).not.toBe('access-123');
    expect(chamada.update.refreshToken).not.toBe('refresh-123');
    // Formato reconhecível do ciphertext (ver MelhorEnvioTokenCryptoService).
    expect(chamada.create.accessToken).toMatch(/^v1:/);
    expect(chamada.create.refreshToken).toMatch(/^v1:/);
    // Descriptografar de volta (Caso H) devolve exatamente o original.
    expect(tokenCrypto.decrypt(chamada.create.accessToken)).toBe('access-123');
    expect(tokenCrypto.decrypt(chamada.create.refreshToken)).toBe('refresh-123');
  });

  // Fail-safe (Etapa 8.4) — sem a chave de criptografia configurada, a
  // troca de code por token precisa FALHAR explicitamente ao tentar
  // persistir, nunca gravar o token em texto puro como alternativa.
  it('sem MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY configurada: trocarCodigoPorToken falha ao persistir, nunca grava token em texto puro', async () => {
    const configSemChave = { ...CONFIG_VALORES };
    delete configSemChave.MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY;
    const { service, prisma } = await criarService(configSemChave);
    const url = new URL(service.gerarUrlAutorizacao());
    const state = url.searchParams.get('state')!;

    global.fetch = mockFetchOnce(200, {
      access_token: 'access-x',
      refresh_token: 'refresh-x',
      expires_in: 3600,
    }) as unknown as typeof fetch;

    await expect(
      service.trocarCodigoPorToken('codigo-valido', state),
    ).rejects.toThrow(InternalServerErrorException);
    expect(prisma.melhorEnvioToken.upsert).not.toHaveBeenCalled();
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
    const { service, prisma, tokenCrypto } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: tokenCrypto.encrypt('access-valido'),
      refreshToken: tokenCrypto.encrypt('refresh-valido'),
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
    const { service, prisma, tokenCrypto } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: tokenCrypto.encrypt('access-velho'),
      refreshToken: tokenCrypto.encrypt('refresh-velho'),
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

    // Caso I (Etapa 8.4) — a chamada de refresh usa o refresh_token
    // DESCRIPTOGRAFADO ('refresh-velho'), nunca o ciphertext bruto lido do
    // banco.
    const corpoRefresh = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as Record<string, string>;
    expect(corpoRefresh.refresh_token).toBe('refresh-velho');

    // Caso I (Etapa 8.4) — o novo par de tokens devolvido pelo refresh
    // também é persistido CRIPTOGRAFADO, nunca em texto puro.
    expect(prisma.melhorEnvioToken.upsert).toHaveBeenCalledTimes(1);
    const chamadaUpsert = prisma.melhorEnvioToken.upsert.mock.calls[0][0] as {
      update: { accessToken: string; refreshToken: string };
    };
    expect(chamadaUpsert.update.accessToken).not.toBe('access-novo');
    expect(chamadaUpsert.update.accessToken).toMatch(/^v1:/);
    expect(tokenCrypto.decrypt(chamadaUpsert.update.accessToken)).toBe(
      'access-novo',
    );
    expect(tokenCrypto.decrypt(chamadaUpsert.update.refreshToken)).toBe(
      'refresh-novo',
    );

    // A segunda chamada (cotação) já usa o token renovado (em texto puro,
    // como a API do Melhor Envio espera), não o antigo nem o ciphertext.
    const headersCotacao = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headersCotacao.Authorization).toBe('Bearer access-novo');
  });

  it('Melhor Envio recusa a cotação (4xx/5xx): propaga MelhorEnvioErroHttpError', async () => {
    const { service, prisma, tokenCrypto } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: tokenCrypto.encrypt('access-valido'),
      refreshToken: tokenCrypto.encrypt('refresh-valido'),
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
    const { service, prisma, tokenCrypto } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: tokenCrypto.encrypt('access-valido'),
      refreshToken: tokenCrypto.encrypt('refresh-valido'),
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNRESET')) as unknown as typeof fetch;

    await expect(
      service.cotar({ cepDestino: '20040-020', pacote: PACOTE, valorDeclarado: 100 }),
    ).rejects.toThrow(MelhorEnvioIndisponivelError);
  });

  it('item de cotação com erro (rota indisponível para aquela transportadora) é filtrado, não quebra a lista', async () => {
    const { service, prisma, tokenCrypto } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: tokenCrypto.encrypt('access-valido'),
      refreshToken: tokenCrypto.encrypt('refresh-valido'),
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
    const { service, prisma, tokenCrypto } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: tokenCrypto.encrypt('segredo-nao-pode-vazar'),
      refreshToken: tokenCrypto.encrypt('refresh-valido'),
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
