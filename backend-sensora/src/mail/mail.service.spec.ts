import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';

// Etapa 8.0 (Finalização do e-mail/Resend) — primeira suíte automatizada de
// MailService. Mesmo padrão de mock de fetch já usado em
// asaas.service.spec.ts: `global.fetch` substituído por um jest.Mock,
// nenhuma chamada de rede real. Cobre especificamente o que a etapa exige
// verificar: tratamento de resposta (2xx/4xx/5xx), timeout/falha de rede, e
// que a API key nunca vaza (nem em erro lançado, nem em log) — enviarEmail()
// NUNCA lança, então a prova de "não vaza" é sobre os argumentos passados ao
// logger, não sobre uma exceção.

const RESEND_API_URL = 'https://api.resend.com/emails';

describe('MailService', () => {
  let fetchMock: jest.Mock;
  let service: MailService;
  let configValues: Record<string, string>;

  beforeEach(async () => {
    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

    configValues = {
      RESEND_API_KEY: 're_segredo_fake_nao_e_uma_chave_real',
      EMAIL_FROM: 'contato@sensora.dev',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
      ],
    }).compile();

    service = module.get(MailService);
  });

  describe('isConfigured', () => {
    it('true quando RESEND_API_KEY e EMAIL_FROM estão setados', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('false quando RESEND_API_KEY está ausente', async () => {
      delete configValues.RESEND_API_KEY;
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
        ],
      }).compile();

      expect(module.get(MailService).isConfigured()).toBe(false);
    });

    it('false quando EMAIL_FROM está ausente', async () => {
      delete configValues.EMAIL_FROM;
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
        ],
      }).compile();

      expect(module.get(MailService).isConfigured()).toBe(false);
    });
  });

  describe('enviarEmail', () => {
    it('não configurado: não chama o Resend, registra warning, nunca lança', async () => {
      delete configValues.RESEND_API_KEY;
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MailService,
          { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
        ],
      }).compile();
      const semConfig = module.get(MailService);
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await expect(
        semConfig.enviarEmail({ to: 'cliente@sensora.dev', subject: 'Assunto', html: '<p>x</p>' }),
      ).resolves.toBeUndefined();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('sucesso: chama o endpoint correto do Resend com Authorization Bearer, Content-Type e corpo esperados', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

      await service.enviarEmail({
        to: 'cliente@sensora.dev',
        subject: 'Confirme seu e-mail',
        html: '<p>Olá</p>',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(RESEND_API_URL);
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${configValues.RESEND_API_KEY}`,
      );
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect(JSON.parse(init.body as string)).toEqual({
        from: configValues.EMAIL_FROM,
        to: 'cliente@sensora.dev',
        subject: 'Confirme seu e-mail',
        html: '<p>Olá</p>',
      });
    });

    it('Resend responde 4xx: registra erro com o status HTTP, nunca lança para quem chamou', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 422 });
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        service.enviarEmail({ to: 'cliente@sensora.dev', subject: 'x', html: '<p>x</p>' }),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('422'));
    });

    it('Resend responde 5xx: registra erro, nunca lança para quem chamou', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        service.enviarEmail({ to: 'cliente@sensora.dev', subject: 'x', html: '<p>x</p>' }),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('503'));
    });

    it('timeout/falha de rede (fetch rejeita): registra erro, nunca lança para quem chamou — provedor indisponível não derruba o fluxo', async () => {
      fetchMock.mockRejectedValueOnce(new Error('The operation was aborted'));
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        service.enviarEmail({ to: 'cliente@sensora.dev', subject: 'x', html: '<p>x</p>' }),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
    });

    it('a API key nunca aparece em nenhuma chamada de log, em nenhum dos cenários acima (sucesso, 4xx, 5xx, falha de rede)', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
      await service.enviarEmail({ to: 'a@sensora.dev', subject: 'x', html: '<p>x</p>' });

      fetchMock.mockResolvedValueOnce({ ok: false, status: 400 });
      await service.enviarEmail({ to: 'b@sensora.dev', subject: 'x', html: '<p>x</p>' });

      fetchMock.mockRejectedValueOnce(new Error('network down'));
      await service.enviarEmail({ to: 'c@sensora.dev', subject: 'x', html: '<p>x</p>' });

      const todasAsChamadas = [...warnSpy.mock.calls, ...errorSpy.mock.calls].flat();
      for (const argumento of todasAsChamadas) {
        expect(String(argumento)).not.toContain(configValues.RESEND_API_KEY);
      }
    });
  });
});
