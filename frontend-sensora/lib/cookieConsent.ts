// Preferência de cookies — isolado de lib/storage.ts (sessão/JWT).
// Formato alinhado à LGPD: essenciais sempre ativos; analytics/marketing
// só com consentimento explícito (opt-in), registrado com data/versão.
import { COOKIE_CONSENT_KEY } from "./constants";

export const COOKIE_CONSENT_VERSION = 2;

export const COOKIE_CONSENT_OPEN_EVENT = "sensora:open-cookie-preferences";
export const COOKIE_CONSENT_CHANGED_EVENT = "sensora:cookie-consent-changed";

export type CookieConsentCategories = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
};

export type CookieConsentPreference = {
  /** Bump manual quando a política mudar — reexibe o aviso se diferente. */
  version: number;
  decidedAt: string;
  categories: CookieConsentCategories;
};

function dispatchConsentChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT));
}

function persist(preference: CookieConsentPreference): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(preference));
    dispatchConsentChanged();
  } catch {
    // Storage indisponível — preferência não persiste nesta sessão.
  }
}

function parseStored(raw: string): CookieConsentPreference | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsentPreference>;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    if (!parsed.decidedAt || !parsed.categories) return null;
    if (parsed.categories.essential !== true) return null;
    if (typeof parsed.categories.analytics !== "boolean") return null;
    if (typeof parsed.categories.marketing !== "boolean") return null;
    return parsed as CookieConsentPreference;
  } catch {
    return null;
  }
}

export function getCookieConsent(): CookieConsentPreference | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    return parseStored(raw);
  } catch {
    return null;
  }
}

export function hasConsentFor(category: "analytics" | "marketing"): boolean {
  const pref = getCookieConsent();
  if (!pref) return false;
  return pref.categories[category];
}

function saveCategories(analytics: boolean, marketing: boolean): void {
  const preference: CookieConsentPreference = {
    version: COOKIE_CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    categories: {
      essential: true,
      analytics,
      marketing,
    },
  };
  persist(preference);
}

/** Aceita cookies opcionais (analytics + marketing). */
export function acceptAllOptionalCookies(): void {
  saveCategories(true, true);
}

/** Recusa cookies opcionais; mantém só o essencial (padrão LGPD). */
export function rejectOptionalCookies(): void {
  saveCategories(false, false);
}

export function saveCustomCookieConsent(analytics: boolean, marketing: boolean): void {
  saveCategories(analytics, marketing);
}

/** Reabre o painel de preferências (ex.: link no rodapé). */
export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_OPEN_EVENT));
}
