// Preferência de cookies/armazenamento local — isolado de lib/storage.ts de
// propósito (aquele arquivo é só sessão/JWT; nada aqui deve se misturar com
// autenticação). Guardado em localStorage sob COOKIE_CONSENT_KEY (nunca
// TOKEN_KEY).
//
// Hoje a Sensora só usa tecnologias essenciais (ver Política de Cookies) —
// por isso o formato abaixo não pede escolha de categoria nenhuma ao
// usuário, só registra "ciente do aviso". `categories.essential` já existe
// no formato (sempre `true`, não editável) para que, no dia em que uma
// categoria opcional de verdade for adicionada (analytics/marketing), o
// formato persistido não precise ser reinventado — só estendido.
import { COOKIE_CONSENT_KEY } from "./constants";

export const COOKIE_CONSENT_VERSION = 1;

export type CookieConsentPreference = {
  /** Bump manual quando a política mudar de forma relevante — uma versão
   *  diferente da atual é tratada como "nunca visto", reexibindo o aviso. */
  version: number;
  acknowledgedAt: string;
  categories: {
    essential: true;
  };
};

export function getCookieConsent(): CookieConsentPreference | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CookieConsentPreference>;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;

    return parsed as CookieConsentPreference;
  } catch {
    return null;
  }
}

export function setCookieConsentAcknowledged(): void {
  if (typeof window === "undefined") return;

  const preference: CookieConsentPreference = {
    version: COOKIE_CONSENT_VERSION,
    acknowledgedAt: new Date().toISOString(),
    categories: { essential: true },
  };

  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(preference));
  } catch {
    // Storage indisponível (modo privado/quota excedida) — o aviso só volta
    // a aparecer a cada visita nesse cenário, sem quebrar o restante do site.
  }
}
