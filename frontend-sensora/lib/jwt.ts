// Portado de frontend/lib/jwt.js — mesma lógica (decodificação manual,
// sem verificação de assinatura — só leitura do payload no client), agora
// tipado contra JwtPayload.
import type { JwtPayload } from "./types/loja";

function decodePayloadSegment(segment: string): JwtPayload | null {
  try {
    let base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }

    const json =
      typeof window !== "undefined"
        ? window.atob(base64)
        : Buffer.from(base64, "base64").toString("utf-8");

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function decodeToken(token: string | null): JwtPayload | null {
  if (!token) return null;

  const segment = token.split(".")[1];
  if (!segment) return null;

  return decodePayloadSegment(segment);
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
