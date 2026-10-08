import * as Sentry from "@sentry/nextjs";
import { opcoesSentry } from "@/lib/sentry";

// Erros no navegador (ver lib/sentry.ts).
Sentry.init(opcoesSentry);
