import * as Sentry from "@sentry/nextjs";
import { opcoesSentry } from "@/lib/sentry";

// Erros no servidor do Next (Server Components, rotas, middleware) — ver
// lib/sentry.ts.
export function register() {
  Sentry.init(opcoesSentry);
}

export const onRequestError = Sentry.captureRequestError;
