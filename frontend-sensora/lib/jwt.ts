// Portado de frontend/lib/jwt.js — mesma lógica (decodificação manual,
// sem verificação de assinatura — só leitura do payload no client), agora
// tipado contra JwtPayload.
import type { JwtPayload } from "./types/loja";

export function decodeToken(token: string | null): JwtPayload | null {
  if (!token || typeof window === "undefined") return null;

  try {
    const payload = token.split(".")[1];
    let base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return JSON.parse(window.atob(base64)) as JwtPayload;
  } catch {
    return null;
  }
}

// Task 17: só olha o `exp` do payload para decidir se a sessão local ainda
// é válida — não verifica assinatura (isso continua sendo responsabilidade
// do backend). Token sem `exp`, vencido ou não decodificável conta como
// expirado, nunca como válido.
export function isTokenExpired(token: string | null): boolean {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;

  return payload.exp * 1000 <= Date.now();
}
