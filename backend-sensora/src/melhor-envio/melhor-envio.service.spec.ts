import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MelhorEnvioTokenCryptoService } from './melhor-envio-token-crypto.service';
import {
  CODIGO_ERRO_FRETE_MELHOR_ENVIO,
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
    // state = payload cifrado (AES-256-GCM) em base64url — nunca em memória.
    expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{60,}$/);
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
  it('sem MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY configurada: a conexão falha já ao gerar o state, nunca chama o Melhor Envio nem grava token em texto puro', async () => {
    const configSemChave = { ...CONFIG_VALORES };
    delete configSemChave.MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY;
    const { service, prisma } = await criarService(configSemChave);
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    expect(() => service.gerarUrlAutorizacao()).toThrow(
      InternalServerErrorException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.melhorEnvioToken.upsert).not.toHaveBeenCalled();
  });

  it('mesmo state não pode ser reutilizado (uso único)', async () => {
    const { service, prisma } = await criarService();
    const url = new URL(service.gerarUrlAutorizacao());
    const state = url.searchParams.get('state')!;

    prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce(null);
    global.fetch = mockFetchOnce(200, {
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
    }) as unknown as typeof fetch;
    await service.trocarCodigoPorToken('codigo-1', state);

    // O banco agora tem o token gravado DEPOIS da emissão do state.
    prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce({
      atualizadoEm: new Date(Date.now() + 1),
    });

    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      service.trocarCodigoPorToken('codigo-2', state),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('state válido emitido por uma instância é aceito por OUTRA instância (sem memória local)', async () => {
    const chave = randomBytes(32).toString('base64');
    const config = { ...CONFIG_VALORES, MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY: chave };
    const maquinaA = await criarService(config);
    const maquinaB = await criarService(config);

    const state = new URL(maquinaA.service.gerarUrlAutorizacao()).searchParams.get(
      'state',
    )!;

    maquinaB.prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce(null);
    maquinaB.prisma.melhorEnvioToken.upsert.mockResolvedValueOnce({});
    global.fetch = mockFetchOnce(200, {
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
    }) as unknown as typeof fetch;

    await expect(
      maquinaB.service.trocarCodigoPorToken('codigo', state),
    ).resolves.toBeUndefined();
    expect(maquinaB.prisma.melhorEnvioToken.upsert).toHaveBeenCalledTimes(1);
  });

  it('state expirado (mais de 10 min) é rejeitado, nunca chama o Melhor Envio', async () => {
    const { service } = await criarService();
    const agora = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(agora);
    const state = new URL(service.gerarUrlAutorizacao()).searchParams.get('state')!;

    nowSpy.mockReturnValue(agora + 10 * 60_000 + 1);
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(service.trocarCodigoPorToken('codigo', state)).rejects.toThrow(
      /state inválido ou expirado/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('state adulterado ou cifrado com outra chave é rejeitado', async () => {
    const { service } = await criarService();
    const state = new URL(service.gerarUrlAutorizacao()).searchParams.get('state')!;
    const meio = Math.floor(state.length / 2);
    const adulterado =
      state.slice(0, meio) + (state[meio] === 'A' ? 'B' : 'A') + state.slice(meio + 1);

    const outraChave = await criarService({
      ...CONFIG_VALORES,
      MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    });
    const deOutraChave = new URL(
      outraChave.service.gerarUrlAutorizacao(),
    ).searchParams.get('state')!;

    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(service.trocarCodigoPorToken('c', adulterado)).rejects.toThrow(
      /state inválido ou expirado/,
    );
    await expect(service.trocarCodigoPorToken('c', deOutraChave)).rejects.toThrow(
      /state inválido ou expirado/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('state emitido antes de uma conexão mais recente (gravada por qualquer máquina) é rejeitado', async () => {
    const { service, prisma } = await criarService();
    const state = new URL(service.gerarUrlAutorizacao()).searchParams.get('state')!;

    prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce({
      atualizadoEm: new Date(Date.now() + 5_000),
    });
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(service.trocarCodigoPorToken('c', state)).rejects.toThrow(
      /state já utilizado/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('o state nunca contém client_secret nem tokens — e a troca do code envia o User-Agent configurado', async () => {
    const { service, prisma, tokenCrypto } = await criarService();
    const state = new URL(service.gerarUrlAutorizacao()).searchParams.get('state')!;
    const conteudo = tokenCrypto.decrypt(
      Buffer.from(state, 'base64url').toString('utf8'),
    );
    expect(conteudo).not.toContain('client-secret-teste');
    expect(Object.keys(JSON.parse(conteudo) as object).sort()).toEqual([
      'e',
      'f',
      'i',
      'n',
    ]);

    prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce(null);
    prisma.melhorEnvioToken.upsert.mockResolvedValueOnce({});
    const fetchMock = mockFetchOnce(200, {
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await service.trocarCodigoPorToken('codigo', state);

    const [urlChamada, opcoes] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(urlChamada).toBe('https://sandbox.melhorenvio.com.br/oauth/token');
    expect((opcoes.headers as Record<string, string>)['User-Agent']).toBe(
      CONFIG_VALORES.MELHOR_ENVIO_USER_AGENT,
    );
  });

  // Reconexão (botão "Reconectar" do Admin): já existe um token salvo — por
  // exemplo de outra conta/app, que o Melhor Envio passou a recusar com 401.
  // Um state emitido AGORA (depois da última gravação desse token) é aceito,
  // e o token novo SOBRESCREVE o antigo via upsert — nada é apagado antes.
  it('reconexão: com um token antigo salvo, um state novo é aceito e o token é sobrescrito (upsert), nunca apagado', async () => {
    const { service, prisma, tokenCrypto } = await criarService();
    const tokenAntigoGravadoEm = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const state = new URL(service.gerarUrlAutorizacao()).searchParams.get('state')!;

    prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce({
      atualizadoEm: tokenAntigoGravadoEm,
    });
    prisma.melhorEnvioToken.upsert.mockResolvedValueOnce({});
    (prisma.melhorEnvioToken as Record<string, jest.Mock>).delete = jest.fn();
    (prisma.melhorEnvioToken as Record<string, jest.Mock>).deleteMany = jest.fn();
    const fetchMock = mockFetchOnce(200, {
      access_token: 'access-conta-nova',
      refresh_token: 'refresh-conta-nova',
      expires_in: 3600,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await service.trocarCodigoPorToken('codigo-da-reconexao', state);

    // Troca do code com o User-Agent configurado.
    const [, opcoes] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((opcoes.headers as Record<string, string>)['User-Agent']).toBe(
      CONFIG_VALORES.MELHOR_ENVIO_USER_AGENT,
    );
    // Sobrescreve o registro único (id 1) com o token novo, cifrado.
    expect(prisma.melhorEnvioToken.upsert).toHaveBeenCalledTimes(1);
    const chamada = prisma.melhorEnvioToken.upsert.mock.calls[0][0] as {
      where: unknown;
      update: { accessToken: string };
    };
    expect(chamada.where).toEqual({ id: 1 });
    expect(tokenCrypto.decrypt(chamada.update.accessToken)).toBe('access-conta-nova');
    // Nunca apaga o token antigo manualmente.
    expect(prisma.melhorEnvioToken.delete).not.toHaveBeenCalled();
    expect(prisma.melhorEnvioToken.deleteMany).not.toHaveBeenCalled();
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

  // Achado da auditoria (Etapa 6.5) — CreateEnderecoDto aceita CEP com ou
  // sem hífen, mas a API do Melhor Envio espera `postal_code` só com
  // dígitos. CONFIG_VALORES já configura MELHOR_ENVIO_CEP_ORIGEM com hífen
  // ('80000-000'), então este teste exercita os dois lados do payload
  // (origem via env, destino via input) na mesma chamada.
  it('normaliza CEP com hífen (origem e destino) para somente dígitos no payload enviado ao Melhor Envio', async () => {
    const { service, prisma, tokenCrypto } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: tokenCrypto.encrypt('access-valido'),
      refreshToken: tokenCrypto.encrypt('refresh-valido'),
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await service.cotar({
      cepDestino: '12345-678',
      pacote: PACOTE,
      valorDeclarado: 100,
    });

    const corpo = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as { from: { postal_code: string }; to: { postal_code: string } };
    expect(corpo.from.postal_code).toBe('80000000');
    expect(corpo.to.postal_code).toBe('12345678');
  });

  it('mantém inalterado no payload um CEP de destino já salvo sem hífen', async () => {
    const { service, prisma, tokenCrypto } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: tokenCrypto.encrypt('access-valido'),
      refreshToken: tokenCrypto.encrypt('refresh-valido'),
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await service.cotar({
      cepDestino: '12345678',
      pacote: PACOTE,
      valorDeclarado: 100,
    });

    const corpo = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as { to: { postal_code: string } };
    expect(corpo.to.postal_code).toBe('12345678');
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
    // A renovação também envia o User-Agent exigido pela API.
    expect(
      ((fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>)[
        'User-Agent'
      ],
    ).toBe(CONFIG_VALORES.MELHOR_ENVIO_USER_AGENT);

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

  // Achado da auditoria (Etapa 6.5) — antes desta correção, o frontend
  // (lib/errors.ts) descartava QUALQUER mensagem de erro com status >= 500,
  // então esta mensagem segura ("O Melhor Envio recusou a cotação") nunca
  // chegava à tela. `code` é o contrato explícito que permite ao frontend
  // reconhecer que esta mensagem específica é segura para exibir, mesmo
  // sendo um 502.
  it('erro de cotação do Melhor Envio chega com o código explícito CODIGO_ERRO_FRETE_MELHOR_ENVIO (consumido por lib/errors.ts no frontend)', async () => {
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

    let erroCapturado: MelhorEnvioErroHttpError | undefined;
    try {
      await service.cotar({
        cepDestino: '20040-020',
        pacote: PACOTE,
        valorDeclarado: 100,
      });
    } catch (erro) {
      erroCapturado = erro as MelhorEnvioErroHttpError;
    }

    expect(erroCapturado).toBeInstanceOf(MelhorEnvioErroHttpError);
    expect(erroCapturado?.getStatus()).toBe(502);
    expect(erroCapturado?.getResponse()).toEqual({
      message: 'O Melhor Envio recusou a cotação',
      code: CODIGO_ERRO_FRETE_MELHOR_ENVIO,
    });
  });

  // Mesmo contrato acima, mas para o caminho "loja não conectada"
  // (MelhorEnvioNaoConectadoError, InternalServerErrorException/500) — o
  // teste "sem conexão prévia" já cobre o tipo da exceção; este cobre
  // especificamente que ela também sai com o código explícito quando
  // atravessa `cotar()`.
  it('erro "loja não conectada" também chega com o código explícito CODIGO_ERRO_FRETE_MELHOR_ENVIO', async () => {
    const { service, prisma } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce(null);
    global.fetch = jest.fn() as unknown as typeof fetch;

    let erroCapturado: MelhorEnvioNaoConectadoError | undefined;
    try {
      await service.cotar({
        cepDestino: '20040-020',
        pacote: PACOTE,
        valorDeclarado: 100,
      });
    } catch (erro) {
      erroCapturado = erro as MelhorEnvioNaoConectadoError;
    }

    expect(erroCapturado).toBeInstanceOf(MelhorEnvioNaoConectadoError);
    expect(erroCapturado?.getResponse()).toEqual({
      message: 'A loja ainda não está conectada ao Melhor Envio.',
      code: CODIGO_ERRO_FRETE_MELHOR_ENVIO,
    });
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

// Central de Integrações (Admin) — configured/ambienteConfigurado/
// obterStatusConexao/verificarOperacional. Mesmo padrão de mock de
// fetch/prisma já usado nos blocos acima; verificarOperacional reaproveita
// garantirAccessToken (testado à exaustão em "cotar" acima), então aqui só
// se prova que GET /api/v2/me é chamado com o token certo e que qualquer
// falha vira `{ operational: false, mensagem }` seguro, nunca uma exceção.
describe('MelhorEnvioService — Central de Integrações (Admin)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('configured reflete a presença de CLIENT_ID/CLIENT_SECRET/REDIRECT_URI', async () => {
    const { service } = await criarService();
    expect(service.configured).toBe(true);

    const { service: semCredenciais } = await criarService({
      MELHOR_ENVIO_ENV: 'sandbox',
    });
    expect(semCredenciais.configured).toBe(false);
  });

  it('ambienteConfigurado reflete MELHOR_ENVIO_ENV (default sandbox)', async () => {
    const { service } = await criarService();
    expect(service.ambienteConfigurado).toBe('sandbox');

    const { service: producao } = await criarService({
      ...CONFIG_VALORES,
      MELHOR_ENVIO_ENV: 'production',
    });
    expect(producao.ambienteConfigurado).toBe('production');
  });

  describe('obterStatusConexao', () => {
    it('não conectado: conectado=false, expiresAt=null', async () => {
      const { service, prisma } = await criarService();
      prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce(null);

      await expect(service.obterStatusConexao()).resolves.toEqual({
        configured: true,
        conectado: false,
        ambiente: 'sandbox',
        expiresAt: null,
      });
    });

    it('conectado: conectado=true, expiresAt reflete o token salvo — nunca o valor do token', async () => {
      const { service, prisma, tokenCrypto } = await criarService();
      const expiresAt = new Date('2026-12-31T23:59:59.000Z');
      prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce({
        accessToken: tokenCrypto.encrypt('access-nao-deve-aparecer'),
        refreshToken: tokenCrypto.encrypt('refresh-nao-deve-aparecer'),
        expiresAt,
      });

      const resultado = await service.obterStatusConexao();

      expect(resultado).toEqual({
        configured: true,
        conectado: true,
        ambiente: 'sandbox',
        expiresAt: expiresAt.toISOString(),
      });
      expect(JSON.stringify(resultado)).not.toContain('nao-deve-aparecer');
    });
  });

  describe('verificarOperacional', () => {
    it('não conectado: operational=false com a mesma mensagem de MelhorEnvioNaoConectadoError, nunca chama fetch', async () => {
      const { service, prisma } = await criarService();
      prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce(null);
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(service.verificarOperacional()).resolves.toEqual({
        operational: false,
        mensagem: 'A loja ainda não está conectada ao Melhor Envio.',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('conectado, token válido: GET /api/v2/me com o access token certo -> operational=true', async () => {
      const { service, prisma, tokenCrypto } = await criarService();
      prisma.melhorEnvioToken.findUnique.mockResolvedValue({
        accessToken: tokenCrypto.encrypt('access-valido'),
        refreshToken: tokenCrypto.encrypt('refresh-valido'),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      });
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as unknown as Response);
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(service.verificarOperacional()).resolves.toEqual({
        operational: true,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://sandbox.melhorenvio.com.br/api/v2/me');
      expect(init.method).toBe('GET');
      expect((init.headers as Record<string, string>).Authorization).toBe(
        'Bearer access-valido',
      );
    });

    it('Melhor Envio recusa a verificação (não-OK): operational=false com mensagem segura, nunca o corpo cru', async () => {
      const { service, prisma, tokenCrypto } = await criarService();
      prisma.melhorEnvioToken.findUnique.mockResolvedValue({
        accessToken: tokenCrypto.encrypt('access-valido'),
        refreshToken: tokenCrypto.encrypt('refresh-valido'),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      });
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as unknown as Response) as unknown as typeof fetch;

      await expect(service.verificarOperacional()).resolves.toEqual({
        operational: false,
        mensagem: 'O Melhor Envio recusou a verificação da conexão.',
      });
    });

    it('falha de rede: operational=false, nunca lança', async () => {
      const { service, prisma, tokenCrypto } = await criarService();
      prisma.melhorEnvioToken.findUnique.mockResolvedValue({
        accessToken: tokenCrypto.encrypt('access-valido'),
        refreshToken: tokenCrypto.encrypt('refresh-valido'),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      });
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED')) as unknown as typeof fetch;

      await expect(service.verificarOperacional()).resolves.toEqual({
        operational: false,
        mensagem: 'Não foi possível se comunicar com o Melhor Envio.',
      });
    });
  });
});
