import * as Sentry from '@sentry/nestjs';

// Monitoramento de erros técnicos (Sentry). Precisa ser importado ANTES de
// qualquer outro módulo em main.ts. Sem SENTRY_DSN, fica desligado (dev,
// testes, ambiente sem conta configurada).
//
// Só erros inesperados chegam aqui (ver AllExceptionsFilter). Nunca envia
// corpo da requisição (senha, dados de checkout), cookies, Authorization
// nem IP do cliente.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.NODE_ENV ?? 'development',
  // O padrão coleta tudo (inclusive corpos de requisição/resposta, também
  // das chamadas ao Asaas): aqui tudo desligado.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
  // Segunda camada: remove o que ainda vier no evento.
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.query_string;
    }
    delete event.user;
    return event;
  },
});
