import { CloudflareAwareThrottlerGuard } from './render-throttler.guard';

// Etapa 8.11 (complemento — IP real no throttling atrás do Render) — prova
// que o tracker usado pelo throttling de auth:
// (1) em produção, usa CF-Connecting-IP quando presente e não vazio;
// (2) em produção, sem o header (ausente ou vazio), cai para req.ip;
// (3) fora de produção, ignora CF-Connecting-IP por completo, mesmo se
//     presente, e usa sempre req.ip;
// (4) nunca lê X-Forwarded-For/req.ips em nenhum cenário.
//
// getTracker() é `protected` no ThrottlerGuard original — os construtores
// (options/storageService/reflector) nunca são usados por getTracker (só
// atribuídos a campos, ver throttler.guard.js), então passar stubs vazios é
// suficiente; não é preciso montar o TestingModule/DI do Nest para isto.

describe('CloudflareAwareThrottlerGuard — tracker de IP atrás do Render (Etapa 8.11)', () => {
  let guard: CloudflareAwareThrottlerGuard & {
    getTracker(req: Record<string, unknown>): Promise<string>;
  };
  const nodeEnvOriginal = process.env.NODE_ENV;

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

  it('produção + CF-Connecting-IP presente: usa o valor do header', async () => {
    process.env.NODE_ENV = 'production';
    const req = {
      ip: '10.0.0.1',
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    };

    await expect(guard.getTracker(req)).resolves.toBe('203.0.113.9');
  });

  it('produção + header ausente: usa req.ip', async () => {
    process.env.NODE_ENV = 'production';
    const req = { ip: '10.0.0.1', headers: {} };

    await expect(guard.getTracker(req)).resolves.toBe('10.0.0.1');
  });

  it('produção + header vazio (string vazia): usa req.ip', async () => {
    process.env.NODE_ENV = 'production';
    const req = { ip: '10.0.0.1', headers: { 'cf-connecting-ip': '' } };

    await expect(guard.getTracker(req)).resolves.toBe('10.0.0.1');
  });

  it('fora de produção + CF-Connecting-IP presente: ignora o header, usa req.ip', async () => {
    process.env.NODE_ENV = 'development';
    const req = {
      ip: '10.0.0.1',
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    };

    await expect(guard.getTracker(req)).resolves.toBe('10.0.0.1');
  });

  it('NODE_ENV indefinido (como em dev local, sem .env) + CF-Connecting-IP presente: ignora o header, usa req.ip', async () => {
    delete process.env.NODE_ENV;
    const req = {
      ip: '10.0.0.1',
      headers: { 'cf-connecting-ip': '203.0.113.9' },
    };

    await expect(guard.getTracker(req)).resolves.toBe('10.0.0.1');
  });

  it('X-Forwarded-For nunca é consultado, mesmo em produção e mesmo sem CF-Connecting-IP', async () => {
    process.env.NODE_ENV = 'production';
    const req = {
      ip: '10.0.0.1',
      ips: ['1.2.3.4', '5.6.7.8'],
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    };

    // Nem X-Forwarded-For nem req.ips influenciam o resultado — só
    // CF-Connecting-IP (ausente aqui) ou req.ip.
    await expect(guard.getTracker(req)).resolves.toBe('10.0.0.1');
  });
});
