// Portado de frontend/lib/storage.js — mesma lógica, só tipado.
import { CHECKOUT_PENDENTE_KEY, TOKEN_KEY } from "./constants";
import { decodeToken, isTokenExpired } from "./jwt";

function setAuthCookie(token: string): void {
  if (typeof document === "undefined") return;

  const payload = decodeToken(token);
  const maxAge = payload?.exp
    ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000))
    : 0;

  if (maxAge <= 0) return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
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

export function removeToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  clearAuthCookie();
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
