import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  private readonly apiKey?: string;
  private readonly from?: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.from = this.configService.get<string>('EMAIL_FROM');
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.from);
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
        'Envio de e-mail ignorado: RESEND_API_KEY/EMAIL_FROM não configurados neste ambiente.',
      );
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
}
