// Portado de frontend/lib/storage.js — mesma lógica, só tipado.
import { CHECKOUT_PENDENTE_KEY, LEMBRAR_KEY, REFRESH_TOKEN_KEY, TOKEN_KEY } from "./constants";
import { decodeToken, isTokenExpired } from "./jwt";

function setAuthCookie(token: string): void {
  if (typeof document === "undefined") return;

  const payload = decodeToken(token);
  const maxAge = payload?.exp
    ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000))
    : 0;

  if (maxAge <= 0) return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // Sem "Lembrar de mim": cookie de sessão (sem max-age), que o navegador
  // apaga ao fechar.
  const duracao = getLembrar() ? `; max-age=${maxAge}` : "";
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/${duracao}; SameSite=Lax${secure}`;
}

function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

// Mantém o cookie de sessão alinhado ao localStorage — necessário para o
// middleware (que não tem acesso ao localStorage) e para migração de sessões
// já abertas antes da introdução do cookie.
export function syncAuthCookieFromStorage(): void {
  const token = getToken();
  if (token && !isTokenExpired(token)) {
    setAuthCookie(token);
  } else {
    clearAuthCookie();
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  setAuthCookie(token);
}

// Remove a sessão inteira: token de acesso e refresh token.
export function removeToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(LEMBRAR_KEY);
  clearAuthCookie();
}

// "Lembrar de mim": só um login feito SEM marcar grava "0". Sessões antigas
// (sem a chave) continuam lembradas, como sempre foram.
export function getLembrar(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(LEMBRAR_KEY) !== "0";
}

export function setLembrar(lembrar: boolean): void {
  if (typeof window === "undefined") return;
  if (lembrar) window.localStorage.removeItem(LEMBRAR_KEY);
  else window.localStorage.setItem(LEMBRAR_KEY, "0");
}

// Login sem "Lembrar de mim": o cookie de sessão some quando o navegador
// fecha, mas os tokens ficam no localStorage. Cookie ausente = o navegador
// foi fechado desde o login, então a sessão deve acabar.
export function sessaoDoNavegadorAcabou(): boolean {
  if (typeof document === "undefined" || getLembrar() || !getToken()) return false;
  return !document.cookie.split("; ").some((cookie) => cookie.startsWith(`${TOKEN_KEY}=`));
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(refreshToken: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

// Etapa 2 (Minha Conta / limpeza do carrinho) — ver constants.ts
// (CHECKOUT_PENDENTE_KEY) para o papel exato: identifica, em
// /checkout/sucesso, qual sessão de checkout voltou, para confirmar o status
// real (buscarStatusSessao) antes de esvaziar o carrinho.
export function getCheckoutPendente(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CHECKOUT_PENDENTE_KEY);
}

export function setCheckoutPendente(sessionId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHECKOUT_PENDENTE_KEY, sessionId);
}

export function removeCheckoutPendente(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHECKOUT_PENDENTE_KEY);
}
