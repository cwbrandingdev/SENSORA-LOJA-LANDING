// Portado de frontend/lib/storage.js — mesma lógica, só tipado.
import { CHECKOUT_PENDENTE_KEY, TOKEN_KEY } from "./constants";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
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
