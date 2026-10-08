import type { ErrorEvent } from "@sentry/nextjs";

// Monitoramento de erros técnicos (Sentry) — opções comuns ao navegador
// (instrumentation-client.ts) e ao servidor (instrumentation.ts). Sem
// NEXT_PUBLIC_SENTRY_DSN, fica desligado. O DSN é público por natureza (vai
// para o navegador); não é segredo.
//
// Nunca envia dados do cliente: corpos de requisição/resposta, headers,
// cookies, query string e dados de usuário desligados, e removidos de novo
// no beforeSend. Sem tracing nem replay — só erros.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const opcoesSentry = {
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
  beforeSend(event: ErrorEvent) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.query_string;
    }
    delete event.user;
    return event;
  },
};
