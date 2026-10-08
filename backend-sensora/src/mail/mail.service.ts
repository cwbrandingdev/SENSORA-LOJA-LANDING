import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EnviarEmailParams {
  to: string;
  subject: string;
  html: string;
}

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 10000;

// RESEND_API_KEY/EMAIL_FROM não estão no ConfigModule.validationSchema
// (app.module.ts) de propósito — mesmo padrão de IMAGEKIT_* em
// imagekit.service.ts: são opcionais para o boot da aplicação, e sem elas
// configuradas o envio simplesmente não acontece (ver isConfigured()),
// nunca derrubando quem chamou enviarEmail() (Task 26).
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly provider: string;
  private readonly apiKey?: string;
  private readonly from?: string;
  private readonly mailTo?: string;
  private readonly smtpTransporter?: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.provider = (
      this.configService.get<string>('MAIL_PROVIDER') ?? 'resend'
    ).trim().toLowerCase();
    this.apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.from =
      this.configService.get<string>('MAIL_FROM') ||
      this.configService.get<string>('EMAIL_FROM');
    this.mailTo = this.configService.get<string>('MAIL_TO')?.trim() || undefined;

    if (this.provider === 'smtp') {
      const host = this.configService.get<string>('SMTP_HOST')?.trim();
      const user = this.configService.get<string>('SMTP_USER')?.trim();
      const pass = this.configService.get<string>('SMTP_PASS');
      const port = Number(this.configService.get<string>('SMTP_PORT') ?? 465);
      const secure =
        (this.configService.get<string>('SMTP_SECURE') ?? 'true').toLowerCase() !==
        'false';

      if (host && user && pass && this.from) {
        this.smtpTransporter = nodemailer.createTransport({
          host,
          port: Number.isFinite(port) ? port : 465,
          secure,
          auth: { user, pass },
        });
      }
    }
  }

  isConfigured(): boolean {
    if (this.provider === 'smtp') {
      return Boolean(this.smtpTransporter && this.from);
    }
    return Boolean(this.apiKey && this.from);
  }

  // Central de Integrações (Admin) — `from` (EMAIL_FROM) não é secreto: é o
  // endereço que já aparece para qualquer destinatário de um e-mail da
  // Sensora, diferente de RESEND_API_KEY (nunca exposta). Resend já foi
  // validado em produção com envio real — esta etapa não adiciona
  // verificação ao vivo (não dispara e-mail nenhum), só mais contexto sobre
  // a configuração existente.
  get remetenteConfigurado(): string | undefined {
    return this.from;
  }

  // Nunca lança: uma falha de e-mail (provedor indisponível, timeout,
  // credencial ausente/errada) não deve derrubar o fluxo que chamou este
  // método — quem chama já deve ter concluído sua operação principal antes
  // de disparar o e-mail. Loga o resultado sem nunca incluir a API key, o
  // destinatário ou o conteúdo do e-mail (mesma política de log de
  // common/filters/all-exceptions.filter.ts).
  async enviarEmail({ to, subject, html }: EnviarEmailParams): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        this.provider === 'smtp'
          ? 'Envio de e-mail ignorado: SMTP/MAIL_FROM não configurados neste ambiente.'
          : 'Envio de e-mail ignorado: RESEND_API_KEY/EMAIL_FROM não configurados neste ambiente.',
      );
      return;
    }

    if (this.provider === 'smtp') {
      await this.enviarViaSmtp({ to, subject, html });
      return;
    }

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to, subject, html }),
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.error(
          `Falha ao enviar e-mail via Resend: HTTP ${response.status}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Falha ao enviar e-mail via Resend',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async enviarViaSmtp({
    to,
    subject,
    html,
  }: EnviarEmailParams): Promise<void> {
    try {
      const bcc =
        this.mailTo && this.mailTo.toLowerCase() !== to.toLowerCase()
          ? this.mailTo
          : undefined;

      await this.smtpTransporter!.sendMail({
        from: this.from,
        to,
        bcc,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(
        'Falha ao enviar e-mail via SMTP',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
