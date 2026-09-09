import { CloudflareAwareThrottlerGuard } from './render-throttler.guard';

// Etapa 8.11 (complemento — IP real no throttling atrás do Render) + Etapa
// 10 / CFG-02 (achado da auditoria — CF-Connecting-IP confiado sem
// verificar a origem) — prova que o tracker usado pelo throttling:
// (1) em produção, só usa CF-Connecting-IP quando a CONEXÃO (req.socket.
//     remoteAddress, nunca um header) vem de um range oficial do
//     Cloudflare (IPv4 ou IPv6) E o header está presente/não-vazio;
// (2) em produção, se a conexão NÃO vem de um range do Cloudflare, o
//     header é ignorado por completo, mesmo presente — cai para req.ip;
// (3)/(4) em produção, mesmo com origem Cloudflare confirmada, header
//     ausente ou vazio cai para req.ip (fallback seguro, comportamento já
//     existente);
// (5) fora de produção, tudo isso é ignorado — sempre req.ip, comportamento
//     local inalterado;
// (6) nunca lê X-Forwarded-For/req.ips em nenhum cenário, mesmo com origem
//     Cloudflare confirmada.
//
// getTracker() é `protected` no ThrottlerGuard original — os construtores
// (options/storageService/reflector) nunca são usados por getTracker (só
// atribuídos a campos, ver throttler.guard.js), então passar stubs vazios é
// suficiente; não é preciso montar o TestingModule/DI do Nest para isto.

describe('CloudflareAwareThrottlerGuard — tracker de IP atrás do Render (Etapa 8.11 + CFG-02)', () => {
  let guard: CloudflareAwareThrottlerGuard & {
    getTracker(req: Record<string, unknown>): Promise<string>;
  };
  const nodeEnvOriginal = process.env.NODE_ENV;

  // Um IP real de cada range oficial do Cloudflare (ver render-throttler.guard.ts)
  // — não são exemplos arbitrários, são endereços dentro de blocos
  // efetivamente publicados pelo Cloudflare.
  const IP_CLOUDFLARE_V4 = '173.245.48.5'; // dentro de 173.245.48.0/20
  const IP_CLOUDFLARE_V4_MAPEADO_V6 = '::ffff:173.245.48.5';
  const IP_CLOUDFLARE_V6 = '2606:4700::1234'; // dentro de 2606:4700::/32
  const IP_NAO_CLOUDFLARE = '203.0.113.50'; // TEST-NET-3 (RFC 5737), nunca Cloudflare

  beforeEach(() => {
    guard = new CloudflareAwareThrottlerGuard(
      {} as never,
      {} as never,
      {} as never,
    ) as CloudflareAwareThrottlerGuard & {
      getTracker(req: Record<string, unknown>): Promise<string>;
    };
  });

  afterEach(() => {
    process.env.NODE_ENV = nodeEnvOriginal;
  });

  it('produção + origem Cloudflare (IPv4) + CF-Connecting-IP presente: usa o valor do header', async () => {
    process.env.NODE_ENV = 'production';
    const req = {
      ip: '10.0.0.1',
      socket: { remoteAddress: IP_CLOUDFLARE_V4 },
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    };

    await expect(guard.getTracker(req)).resolves.toBe('203.0.113.9');
  });

  it('produção + origem Cloudflare (IPv4 mapeado em IPv6, ex. socket dual-stack) + CF-Connecting-IP presente: usa o valor do header', async () => {
    process.env.NODE_ENV = 'production';
    const req = {
      ip: '10.0.0.1',
      socket: { remoteAddress: IP_CLOUDFLARE_V4_MAPEADO_V6 },
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    };

    await expect(guard.getTracker(req)).resolves.toBe('203.0.113.9');
  });

  it('produção + origem Cloudflare (IPv6) + CF-Connecting-IP presente: usa o valor do header', async () => {
    process.env.NODE_ENV = 'production';
    const req = {
      ip: '10.0.0.1',
      socket: { remoteAddress: IP_CLOUDFLARE_V6 },
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    };

    await expect(guard.getTracker(req)).resolves.toBe('203.0.113.9');
  });

  it('produção + origem NÃO Cloudflare + CF-Connecting-IP presente: NÃO usa o header, cai para req.ip', async () => {
    process.env.NODE_ENV = 'production';
    const req = {
      ip: IP_NAO_CLOUDFLARE,
      socket: { remoteAddress: IP_NAO_CLOUDFLARE },
      // Um atacante que alcance a aplicação diretamente poderia enviar
      // qualquer valor aqui, tentando escolher seu próprio bucket.
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    };

    await expect(guard.getTracker(req)).resolves.toBe(IP_NAO_CLOUDFLARE);
  });

  it('produção + origem Cloudflare + header ausente: usa req.ip (fallback seguro)', async () => {
    process.env.NODE_ENV = 'production';
    const req = {
      ip: '198.51.100.7',
      socket: { remoteAddress: IP_CLOUDFLARE_V4 },
      headers: {},
    };

    await expect(guard.getTracker(req)).resolves.toBe('198.51.100.7');
  });

  it('produção + origem Cloudflare + header vazio (string vazia): usa req.ip (fallback seguro)', async () => {
    process.env.NODE_ENV = 'production';
    const req = {
      ip: '198.51.100.7',
      socket: { remoteAddress: IP_CLOUDFLARE_V4 },
      headers: { 'cf-connecting-ip': '' },
    };

    await expect(guard.getTracker(req)).resolves.toBe('198.51.100.7');
  });

  it('produção + req.socket ausente (fallback para req.ip como IP de conexão) + req.ip não é Cloudflare: NÃO usa o header', async () => {
    process.env.NODE_ENV = 'production';
    const req = {
      ip: IP_NAO_CLOUDFLARE,
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    };

    await expect(guard.getTracker(req)).resolves.toBe(IP_NAO_CLOUDFLARE);
  });

  it('fora de produção + origem Cloudflare + CF-Connecting-IP presente: ignora o header, usa req.ip', async () => {
    process.env.NODE_ENV = 'development';
    const req = {
      ip: '10.0.0.1',
      socket: { remoteAddress: IP_CLOUDFLARE_V4 },
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    };

    await expect(guard.getTracker(req)).resolves.toBe('10.0.0.1');
  });

  it('NODE_ENV indefinido (como em dev local, sem .env) + origem Cloudflare + CF-Connecting-IP presente: ignora o header, usa req.ip', async () => {
    delete process.env.NODE_ENV;
    const req = {
      ip: '10.0.0.1',
      socket: { remoteAddress: IP_CLOUDFLARE_V4 },
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    };

    await expect(guard.getTracker(req)).resolves.toBe('10.0.0.1');
  });

  it('X-Forwarded-For nunca é consultado, mesmo em produção, com origem Cloudflare confirmada e sem CF-Connecting-IP', async () => {
    process.env.NODE_ENV = 'production';
    const req = {
      ip: '10.0.0.1',
      ips: ['1.2.3.4', '5.6.7.8'],
      socket: { remoteAddress: IP_CLOUDFLARE_V4 },
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    };

    // Nem X-Forwarded-For nem req.ips influenciam o resultado — só
    // CF-Connecting-IP (ausente aqui, mesmo com origem confirmada) ou req.ip.
    await expect(guard.getTracker(req)).resolves.toBe('10.0.0.1');
  });
});
