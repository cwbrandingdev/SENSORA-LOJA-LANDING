import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MelhorEnvioTokenCryptoService } from './melhor-envio-token-crypto.service';
import {
  CODIGO_ERRO_FRETE_MELHOR_ENVIO,
  CODIGO_ERRO_LOGISTICA_MELHOR_ENVIO,
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
  // Etapa 8 — $transaction imita a trava FOR UPDATE da linha do token: uma
  // transação só começa depois que a anterior terminou.
  let fila: Promise<unknown> = Promise.resolve();
  const prisma = {
    melhorEnvioToken: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(
      (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
        const resultado: Promise<unknown> = fila.then(() => fn(prisma));
        fila = resultado.catch(() => undefined);
        return resultado;
      },
    ),
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

  it('cotação recusada: o log leva só rota e status, nunca o corpo da resposta (pode repetir o CEP do cliente)', async () => {
    const { service, prisma, tokenCrypto } = await criarService();
    prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: tokenCrypto.encrypt('access-valido'),
      refreshToken: tokenCrypto.encrypt('refresh-valido'),
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    const logs = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: () => Promise.resolve('{"message":"CEP 01310100 inválido"}'),
    });

    await expect(
      service.cotar({
        cepDestino: '01310-100',
        pacote: PACOTE,
        valorDeclarado: 100,
      }),
    ).rejects.toThrow('O Melhor Envio recusou a cotação');

    const registrado = JSON.stringify(logs.mock.calls);
    expect(registrado).toContain('POST /shipment/calculate -> 422');
    expect(registrado).not.toContain('01310100');
    expect(registrado).not.toContain('inválido');
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

  // "Verificar agora" — valida a capacidade real de cotação (escopo
  // shipping-calculate) reutilizando cotar(); nunca GET /api/v2/me.
  describe('verificarOperacional', () => {
    // Pacote EXPLICITAMENTE configurado (o teste de conexão não aceita os
    // valores padrão do construtor).
    const CONFIG_COMPLETA: Record<string, string> = {
      ...CONFIG_VALORES,
      MELHOR_ENVIO_PACOTE_ALTURA_CM: '12',
      MELHOR_ENVIO_PACOTE_LARGURA_CM: '16',
      MELHOR_ENVIO_PACOTE_COMPRIMENTO_CM: '22',
      MELHOR_ENVIO_PACOTE_PESO_GRAMAS: '450',
    };

    function tokenValido(tokenCrypto: MelhorEnvioTokenCryptoService) {
      return {
        accessToken: tokenCrypto.encrypt('access-valido'),
        refreshToken: tokenCrypto.encrypt('refresh-valido'),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      };
    }

    function respostaCotacao(status: number, corpo: unknown) {
      const ok = status >= 200 && status < 300;
      return jest.fn().mockResolvedValueOnce({
        ok,
        status,
        statusText:
          status === 401
            ? 'Unauthorized'
            : status === 403
              ? 'Forbidden'
              : ok
                ? 'OK'
                : 'Erro',
        json: async () => corpo,
        text: async () => JSON.stringify(corpo),
      } as unknown as Response);
    }

    const OPCAO = (id: number) => ({
      id,
      name: `Serviço ${id}`,
      price: '19.90',
      delivery_time: 5,
      company: { name: 'Transportadora' },
    });

    it('sucesso: cota via POST /shipment/calculate reutilizando cotar() (Bearer + User-Agent, CEP de origem, pacote configurado) e nunca chama /api/v2/me', async () => {
      const { service, prisma, tokenCrypto } =
        await criarService(CONFIG_COMPLETA);
      prisma.melhorEnvioToken.findUnique.mockResolvedValue(
        tokenValido(tokenCrypto),
      );
      const fetchMock = respostaCotacao(200, [OPCAO(1), OPCAO(2)]);
      global.fetch = fetchMock as unknown as typeof fetch;

      const resultado = await service.verificarOperacional();

      expect(resultado.operational).toBe(true);
      expect(resultado.mensagem).toContain('2 opções');
      expect(resultado.mensagem).toContain(
        'não garante frete para todos os destinos',
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate',
      );
      expect(url).not.toMatch(/\/api\/v2\/me$/);
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer access-valido');
      expect(headers['User-Agent']).toBe(
        CONFIG_VALORES.MELHOR_ENVIO_USER_AGENT,
      );
      const corpo = JSON.parse(init.body as string) as {
        from: { postal_code: string };
        to: { postal_code: string };
        package: {
          height: number;
          width: number;
          length: number;
          weight: number;
        };
        options: { insurance_value: number };
      };
      // Origem -> ela mesma: nenhum CEP inventado.
      expect(corpo.from.postal_code).toBe('80000000');
      expect(corpo.to.postal_code).toBe('80000000');
      // Exatamente o pacote configurado (não os padrões 10/15/20/300).
      expect(corpo.package).toEqual({
        height: 12,
        width: 16,
        length: 22,
        weight: 0.45,
      });
      expect(corpo.options.insurance_value).toBe(0);
    });

    it('resposta vazia (200 com lista vazia): conexão/escopo válidos, deixando claro que não garante frete', async () => {
      const { service, prisma, tokenCrypto } =
        await criarService(CONFIG_COMPLETA);
      prisma.melhorEnvioToken.findUnique.mockResolvedValue(
        tokenValido(tokenCrypto),
      );
      global.fetch = respostaCotacao(200, []) as unknown as typeof fetch;

      const resultado = await service.verificarOperacional();

      expect(resultado.operational).toBe(true);
      expect(resultado.mensagem).toContain('sem opções');
      expect(resultado.mensagem).toContain(
        'não garante frete para todos os destinos',
      );
    });

    it('CEP de origem ausente: configuração incompleta, nunca chama o Melhor Envio', async () => {
      const config = { ...CONFIG_COMPLETA };
      delete config.MELHOR_ENVIO_CEP_ORIGEM;
      const { service, prisma } = await criarService(config);
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const resultado = await service.verificarOperacional();

      expect(resultado.operational).toBe(false);
      expect(resultado.mensagem).toContain('Configuração incompleta');
      expect(resultado.mensagem).toContain('MELHOR_ENVIO_CEP_ORIGEM');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.melhorEnvioToken.findUnique).not.toHaveBeenCalled();
    });

    it('pacote incompleto (sem peso e sem altura): configuração incompleta, nunca usa os padrões nem chama o Melhor Envio', async () => {
      const config = { ...CONFIG_COMPLETA };
      delete config.MELHOR_ENVIO_PACOTE_PESO_GRAMAS;
      delete config.MELHOR_ENVIO_PACOTE_ALTURA_CM;
      const { service } = await criarService(config);
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      const resultado = await service.verificarOperacional();

      expect(resultado.operational).toBe(false);
      expect(resultado.mensagem).toContain('MELHOR_ENVIO_PACOTE_PESO_GRAMAS');
      expect(resultado.mensagem).toContain('MELHOR_ENVIO_PACOTE_ALTURA_CM');
      expect(resultado.mensagem).not.toContain(
        'MELHOR_ENVIO_PACOTE_LARGURA_CM',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      [401, 'Unauthorized'],
      [403, 'Forbidden'],
    ])(
      'Melhor Envio recusa a cotação com %i: operational=false com a mensagem administrativa de sempre',
      async (status) => {
        const { service, prisma, tokenCrypto } =
          await criarService(CONFIG_COMPLETA);
        prisma.melhorEnvioToken.findUnique.mockResolvedValue(
          tokenValido(tokenCrypto),
        );
        global.fetch = respostaCotacao(status, {
          message: 'Unauthenticated.',
        }) as unknown as typeof fetch;

        await expect(service.verificarOperacional()).resolves.toEqual({
          operational: false,
          mensagem: 'O Melhor Envio recusou a verificação da conexão.',
        });
      },
    );

    it('não conectado: operational=false com a mesma mensagem de MelhorEnvioNaoConectadoError, nunca chama fetch', async () => {
      const { service, prisma } = await criarService(CONFIG_COMPLETA);
      prisma.melhorEnvioToken.findUnique.mockResolvedValueOnce(null);
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(service.verificarOperacional()).resolves.toEqual({
        operational: false,
        mensagem: 'A loja ainda não está conectada ao Melhor Envio.',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('falha de rede: operational=false, nunca lança', async () => {
      const { service, prisma, tokenCrypto } =
        await criarService(CONFIG_COMPLETA);
      prisma.melhorEnvioToken.findUnique.mockResolvedValue(
        tokenValido(tokenCrypto),
      );
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(
          new Error('ECONNREFUSED'),
        ) as unknown as typeof fetch;

      await expect(service.verificarOperacional()).resolves.toEqual({
        operational: false,
        mensagem: 'Não foi possível se comunicar com o Melhor Envio.',
      });
    });

    it('nenhum token, secret ou cabeçalho Authorization aparece nos logs, mesmo numa recusa 401/403', async () => {
      const logs: string[] = [];
      for (const nivel of [
        'log',
        'warn',
        'error',
        'debug',
        'verbose',
      ] as const) {
        jest
          .spyOn(Logger.prototype, nivel)
          .mockImplementation((...args: unknown[]) => {
            logs.push(args.map(String).join(' '));
          });
      }
      const { service, prisma, tokenCrypto } =
        await criarService(CONFIG_COMPLETA);
      prisma.melhorEnvioToken.findUnique.mockResolvedValue(
        tokenValido(tokenCrypto),
      );
      global.fetch = respostaCotacao(403, {
        message: 'This action is unauthorized.',
      }) as unknown as typeof fetch;

      await service.verificarOperacional();

      expect(logs.length).toBeGreaterThan(0); // a recusa foi registrada...
      const tudo = logs.join('\n');
      expect(tudo).toContain('403'); // ...com o status, para diagnóstico
      for (const segredo of [
        'access-valido',
        'refresh-valido',
        'client-secret-teste',
        'Bearer',
        CHAVE_CRIPTOGRAFIA_TESTE,
      ]) {
        expect(tudo).not.toContain(segredo);
      }
    });
  });
});

// Etapa 8 — logística reversa e renovação concorrente do token. `fetch`
// mockado por rota; nenhuma chamada de rede real.
describe('MelhorEnvioService — logística reversa (Etapa 8)', () => {
  const CONFIG_REVERSA: Record<string, string> = {
    ...CONFIG_VALORES,
    MELHOR_ENVIO_PACOTE_PESO_GRAMAS: '300',
    LOJA_NOME: 'Sensora Velas',
    LOJA_DOCUMENTO: '12.345.678/0001-95',
    LOJA_TELEFONE: '41988887777',
    LOJA_EMAIL: 'loja@sensora.dev',
    LOJA_RUA: 'Rua XV de Novembro',
    LOJA_NUMERO: '100',
    LOJA_BAIRRO: 'Centro',
    LOJA_CIDADE: 'Curitiba',
    LOJA_UF: 'PR',
  };

  const REMETENTE = {
    nome: 'Cliente Sensora',
    cpf: '52998224725',
    telefone: '41999998888',
    email: 'cliente@sensora.dev',
    rua: 'Av. Paulista',
    numero: '1000',
    complemento: 'Ap 12',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    cep: '01310-100',
  };

  const REVERSA = {
    servicoId: 1,
    remetente: REMETENTE,
    itens: [{ nome: 'Vela Lavanda', quantidade: 2, valorUnitario: 59.9 }],
    pacote: { alturaCm: 10, larguraCm: 15, comprimentoCm: 20, pesoGramas: 600 },
    valorDeclarado: 119.8,
  };

  // Service conectado com token válido.
  async function conectado(config: Record<string, string> = CONFIG_REVERSA) {
    const criado = await criarService(config);
    criado.prisma.melhorEnvioToken.findUnique.mockResolvedValue({
      accessToken: criado.tokenCrypto.encrypt('access-valido'),
      refreshToken: criado.tokenCrypto.encrypt('refresh-valido'),
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    return criado;
  }

  function resposta(status: number, body: unknown) {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: 'x',
      json: () => Promise.resolve(body),
    } as unknown as Response;
  }

  function corpoDa(fetchMock: jest.Mock, indice = 0) {
    return JSON.parse(
      ((fetchMock.mock.calls as unknown[][])[indice][1] as RequestInit)
        .body as string,
    ) as Record<string, Record<string, unknown>>;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('escopo padrão pede cotação e o ciclo da reversa (carrinho, compra, geração, consulta e impressão secundária)', async () => {
    const { service } = await criarService();
    const escopo = new URL(service.gerarUrlAutorizacao()).searchParams
      .get('scope')!
      .split(' ');
    expect(escopo).toEqual([
      'shipping-calculate',
      'cart-read',
      'cart-write',
      'orders-read',
      'shipping-checkout',
      'shipping-generate',
      'shipping-print',
    ]);
  });

  it('cotarReversa: origem = CEP do cliente, destino = loja; só PAC/SEDEX (aceitos pela reversa)', async () => {
    const { service } = await conectado();
    const fetchMock = jest.fn().mockResolvedValue(
      resposta(200, [
        {
          id: 1,
          name: 'PAC',
          price: '25.35',
          delivery_time: 6,
          company: { name: 'Correios' },
        },
        {
          id: 2,
          name: 'SEDEX',
          price: '41.20',
          delivery_time: 2,
          company: { name: 'Correios' },
        },
        {
          id: 3,
          name: '.Package',
          price: '19.00',
          delivery_time: 5,
          company: { name: 'Jadlog' },
        },
      ]),
    );
    global.fetch = fetchMock;

    const opcoes = await service.cotarReversa(
      '01310-100',
      REVERSA.pacote,
      119.8,
    );

    expect(opcoes.map((o) => o.id)).toEqual([1, 2]);
    const corpo = corpoDa(fetchMock);
    expect(corpo.from).toEqual({ postal_code: '01310100' });
    expect(corpo.to).toEqual({ postal_code: '80000000' });
  });

  it('criarReversa: POST /api/v2/me/cart/reverse com cliente (CPF) como remetente e loja (CNPJ) como destinatária', async () => {
    const { service } = await conectado();
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        resposta(201, { id: 'ord-uuid-1', price: 24.9, status: 'pending' }),
      );
    global.fetch = fetchMock;

    await expect(service.criarReversa(REVERSA)).resolves.toEqual({
      id: 'ord-uuid-1',
      preco: 24.9,
    });

    expect((fetchMock.mock.calls as unknown[][])[0][0]).toBe(
      'https://sandbox.melhorenvio.com.br/api/v2/me/cart/reverse',
    );
    const init = (fetchMock.mock.calls as unknown[][])[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer access-valido',
    );
    expect(corpoDa(fetchMock)).toEqual({
      service: 1,
      new_sender_mail: 'cliente@sensora.dev',
      new_sender_phone: '41999998888',
      insurance_value: 119.8,
      from: {
        name: 'Cliente Sensora',
        document: '52998224725',
        phone: '41999998888',
        email: 'cliente@sensora.dev',
        address: 'Av. Paulista',
        number: '1000',
        complement: 'Ap 12',
        district: 'Bela Vista',
        city: 'São Paulo',
        state_abbr: 'SP',
        postal_code: '01310100',
        country_id: 'BR',
      },
      to: {
        name: 'Sensora Velas',
        company_document: '12345678000195',
        phone: '41988887777',
        email: 'loja@sensora.dev',
        address: 'Rua XV de Novembro',
        number: '100',
        district: 'Centro',
        city: 'Curitiba',
        state_abbr: 'PR',
        postal_code: '80000000',
        country_id: 'BR',
      },
      products: [
        { name: 'Vela Lavanda', quantity: 2, unitary_value: 59.9, weight: 0.3 },
      ],
      package: { height: 10, width: 15, length: 20, weight: 0.6 },
      options: { own_hand: false, receipt: false },
    });
  });

  it('loja com CPF: vai em document, não em company_document', async () => {
    const { service } = await conectado({
      ...CONFIG_REVERSA,
      LOJA_DOCUMENTO: '529.982.247-25',
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValue(resposta(201, { id: 'ord-1' }));
    global.fetch = fetchMock;

    await expect(service.criarReversa(REVERSA)).resolves.toEqual({
      id: 'ord-1',
      preco: null,
    });
    const { to } = corpoDa(fetchMock);
    expect(to.document).toBe('52998224725');
    expect(to.company_document).toBeUndefined();
  });

  it('dados da loja ausentes: lista o que falta e nunca chama o Melhor Envio', async () => {
    const semLoja = { ...CONFIG_REVERSA };
    delete semLoja.LOJA_DOCUMENTO;
    delete semLoja.LOJA_TELEFONE;
    const { service } = await conectado(semLoja);
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    expect(service.dadosLojaFaltando).toEqual([
      'LOJA_DOCUMENTO',
      'LOJA_TELEFONE',
    ]);
    await expect(service.criarReversa(REVERSA)).rejects.toThrow(
      'Dados da loja incompletos: defina LOJA_DOCUMENTO, LOJA_TELEFONE.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('erro do Melhor Envio na reversa: mensagem segura e o log nunca leva o corpo (CPF/endereço)', async () => {
    const { service } = await conectado();
    const logs = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    global.fetch = jest.fn().mockResolvedValue(
      resposta(422, {
        error: { from: ['CPF 52998224725 inválido para Av. Paulista 1000'] },
      }),
    );

    const erro = await service.criarReversa(REVERSA).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(MelhorEnvioErroHttpError);
    expect((erro as Error).message).toContain('HTTP 422');
    expect((erro as Error).message).not.toContain('52998224725');
    const registrado = JSON.stringify(logs.mock.calls);
    expect(registrado).toContain('422');
    expect(registrado).not.toContain('52998224725');
    expect(registrado).not.toContain('Paulista');
  });

  it('comprarEnvio: POST /shipment/checkout com o id', async () => {
    const { service } = await conectado();
    const fetchMock = jest
      .fn()
      .mockResolvedValue(resposta(200, { purchase: { status: 'paid' } }));
    global.fetch = fetchMock;

    await service.comprarEnvio('ord-1');

    expect((fetchMock.mock.calls as unknown[][])[0][0]).toContain(
      '/api/v2/me/shipment/checkout',
    );
    expect(corpoDa(fetchMock)).toEqual({ orders: ['ord-1'] });
  });

  it('comprarEnvio: "já foram pagas" conta como sucesso (nunca cobra duas vezes)', async () => {
    const { service } = await conectado();
    global.fetch = jest.fn().mockResolvedValue(
      resposta(422, {
        message: 'The given data was invalid.',
        errors: { orders: ['Existe uma ou mais orders que já foram pagas.'] },
      }),
    );

    await expect(service.comprarEnvio('ord-1')).resolves.toBeUndefined();
  });

  it('comprarEnvio: saldo insuficiente vira mensagem clara', async () => {
    const { service } = await conectado();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    global.fetch = jest.fn().mockResolvedValue(
      resposta(422, {
        message: 'Saldo insuficiente para realizar a compra.',
      }),
    );

    await expect(service.comprarEnvio('ord-1')).rejects.toThrow(
      'Saldo insuficiente na carteira do Melhor Envio para comprar o envio da devolução.',
    );
  });

  it('erros da logística levam CODIGO_ERRO_LOGISTICA_MELHOR_ENVIO (a mensagem segura chega à tela do ADMIN)', async () => {
    const { service } = await conectado();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(resposta(422, { message: 'Saldo insuficiente.' }))
      .mockRejectedValueOnce(new Error('ECONNRESET'));

    const saldo = (await service
      .comprarEnvio('ord-1')
      .catch((e: unknown) => e)) as MelhorEnvioErroHttpError;
    expect(saldo.getResponse()).toEqual({
      message:
        'Saldo insuficiente na carteira do Melhor Envio para comprar o envio da devolução.',
      code: CODIGO_ERRO_LOGISTICA_MELHOR_ENVIO,
    });

    const rede = (await service
      .gerarEnvio('ord-1')
      .catch((e: unknown) => e)) as MelhorEnvioIndisponivelError;
    expect(rede).toBeInstanceOf(MelhorEnvioIndisponivelError);
    expect(rede.getResponse()).toMatchObject({
      code: CODIGO_ERRO_LOGISTICA_MELHOR_ENVIO,
    });
  });

  it('comprarEnvio: outra recusa vira MelhorEnvioErroHttpError genérico', async () => {
    const { service } = await conectado();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    global.fetch = jest
      .fn()
      .mockResolvedValue(resposta(500, { message: 'erro interno' }));

    await expect(service.comprarEnvio('ord-1')).rejects.toThrow(
      'O Melhor Envio recusou a compra do envio da devolução.',
    );
  });

  it('gerarEnvio: sucesso só com status true para o id', async () => {
    const { service } = await conectado();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        resposta(200, { 'ord-1': { status: true, message: 'ok' } }),
      )
      .mockResolvedValueOnce(
        resposta(200, { 'ord-1': { status: false, message: 'Não gerado' } }),
      );

    await expect(service.gerarEnvio('ord-1')).resolves.toBeUndefined();
    await expect(service.gerarEnvio('ord-1')).rejects.toBeInstanceOf(
      MelhorEnvioErroHttpError,
    );
  });

  it('urlImpressao (secundário): pede a impressão em modo público e só devolve URL https', async () => {
    const { service } = await conectado();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        resposta(200, {
          url: 'https://sandbox.melhorenvio.com.br/imprimir/ixQL',
        }),
      )
      .mockResolvedValueOnce(resposta(200, { url: 'javascript:alert(1)' }));
    global.fetch = fetchMock;

    await expect(service.urlImpressao('ord-1')).resolves.toBe(
      'https://sandbox.melhorenvio.com.br/imprimir/ixQL',
    );
    expect((fetchMock.mock.calls as unknown[][])[0][0]).toContain(
      '/api/v2/me/shipment/print',
    );
    expect(corpoDa(fetchMock)).toEqual({ mode: 'public', orders: ['ord-1'] });

    await expect(service.urlImpressao('ord-1')).rejects.toBeInstanceOf(
      MelhorEnvioErroHttpError,
    );
  });

  it('consultarEnvio: GET /orders/:id, interpreta pago/gerado e as datas (horário de Brasília)', async () => {
    const { service } = await conectado();
    const fetchMock = jest.fn().mockResolvedValue(
      resposta(200, {
        status: 'released',
        paid_at: '2026-09-30 10:00:00',
        generated_at: null,
        posted_at: null,
        tracking: null,
      }),
    );
    global.fetch = fetchMock;

    const situacao = await service.consultarEnvio('ord-1');

    expect((fetchMock.mock.calls as unknown[][])[0][0]).toContain(
      '/api/v2/me/orders/ord-1',
    );
    expect(
      ((fetchMock.mock.calls as unknown[][])[0][1] as RequestInit).method,
    ).toBe('GET');
    expect(situacao).toEqual({
      status: 'released',
      pago: true,
      gerado: false,
      postado: false,
      pagoEm: new Date('2026-09-30T13:00:00Z'),
      geradoEm: null,
      postadoEm: null,
      codigoDevolucao: null,
      codigoRastreio: null,
    });
  });

  it('consultarEnvio: authorization_code vira codigoDevolucao e tracking vira codigoRastreio (conceitos separados); reconhece a postagem', async () => {
    const { service } = await conectado();
    // Mesmos campos do exemplo oficial de GET /api/v2/me/orders/{id}.
    global.fetch = jest.fn().mockResolvedValue(
      resposta(200, {
        id: 'ord-1',
        protocol: 'ORD-20220395517',
        status: 'posted',
        authorization_code: '2022032920',
        tracking: 'ME220021P96BR',
        self_tracking: 'ME220021P96BR',
        paid_at: '2026-09-30 10:00:00',
        generated_at: '2026-09-30 10:01:00',
        posted_at: '2026-10-01 09:00:00',
      }),
    );

    const situacao = await service.consultarEnvio('ord-1');

    expect(situacao).toEqual({
      status: 'posted',
      pago: true,
      gerado: true,
      postado: true,
      pagoEm: new Date('2026-09-30T13:00:00Z'),
      geradoEm: new Date('2026-09-30T13:01:00Z'),
      postadoEm: new Date('2026-10-01T12:00:00Z'),
      codigoDevolucao: '2022032920',
      codigoRastreio: 'ME220021P96BR',
    });
  });

  it('consultarEnvio: gerado sem código ainda (authorization_code null) fica null, nunca inventado', async () => {
    const { service } = await conectado();
    global.fetch = jest.fn().mockResolvedValue(
      resposta(200, {
        status: 'generated',
        authorization_code: null,
        tracking: null,
        generated_at: '2026-09-30 10:01:00',
      }),
    );

    const situacao = await service.consultarEnvio('ord-1');

    expect(situacao.gerado).toBe(true);
    expect(situacao.codigoDevolucao).toBeNull();
    expect(situacao.codigoRastreio).toBeNull();
  });

  it('criarReversa: service_id diferente do pedido é recusado (nada é pago)', async () => {
    const { service } = await conectado();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        resposta(201, { id: 'ord-1', price: 24.9, service_id: 2 }),
      );

    await expect(service.criarReversa(REVERSA)).rejects.toThrow(
      'O Melhor Envio criou o envio com outro serviço de frete. Nada foi cobrado; tente novamente.',
    );
  });

  it('criarReversa: service_id igual ao pedido (número ou texto) é aceito', async () => {
    const { service } = await conectado();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        resposta(201, { id: 'ord-1', price: 24.9, service_id: 1 }),
      )
      .mockResolvedValueOnce(
        resposta(201, { id: 'ord-2', price: '24.90', service_id: '1' }),
      );

    await expect(service.criarReversa(REVERSA)).resolves.toEqual({
      id: 'ord-1',
      preco: 24.9,
    });
    await expect(service.criarReversa(REVERSA)).resolves.toEqual({
      id: 'ord-2',
      preco: 24.9,
    });
  });

  it('renovação concorrente do token: duas chamadas com o token vencendo renovam UMA vez; a segunda usa o token novo', async () => {
    const { service, prisma, tokenCrypto } = await criarService(CONFIG_REVERSA);
    // "Banco": o upsert grava e o findUnique seguinte lê o valor gravado.
    let tokenSalvo = {
      accessToken: tokenCrypto.encrypt('access-velho'),
      refreshToken: tokenCrypto.encrypt('refresh-velho'),
      expiresAt: new Date(Date.now() - 60_000),
    };
    prisma.melhorEnvioToken.findUnique.mockImplementation(() =>
      Promise.resolve({ ...tokenSalvo }),
    );
    prisma.melhorEnvioToken.upsert.mockImplementation(
      ({ update }: { update: typeof tokenSalvo }) => {
        tokenSalvo = { ...update };
        return Promise.resolve(tokenSalvo);
      },
    );

    const fetchMock = jest.fn(async (url: string) => {
      await new Promise((resolve) => setImmediate(resolve));
      if (url.endsWith('/oauth/token')) {
        return resposta(200, {
          access_token: 'access-novo',
          refresh_token: 'refresh-novo',
          expires_in: 3600,
        });
      }
      return resposta(200, { id: 'x', status: 'pending' });
    });
    global.fetch = fetchMock;

    await Promise.all([
      service.consultarEnvio('ord-1'),
      service.consultarEnvio('ord-2'),
    ]);

    const renovacoes = fetchMock.mock.calls.filter(([url]) =>
      url.endsWith('/oauth/token'),
    );
    expect(renovacoes).toHaveLength(1);
    expect(prisma.melhorEnvioToken.upsert).toHaveBeenCalledTimes(1);
    const autorizacoes = fetchMock.mock.calls
      .filter(([url]) => url.includes('/orders/'))
      .map(
        (chamada) =>
          ((chamada as unknown[])[1] as RequestInit).headers as Record<
            string,
            string
          >,
      )
      .map((headers) => headers.Authorization);
    expect(autorizacoes).toEqual(['Bearer access-novo', 'Bearer access-novo']);
  });
});
