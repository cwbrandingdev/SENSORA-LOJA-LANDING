// Renovação da sessão: troca o refresh token por um par novo
// (POST /auth/refresh). O token de acesso dura 1h e o refresh token 7 dias,
// e cada renovação gera um refresh token novo de mais 7 dias — então a
// pessoa só é deslogada depois de 7 dias SEM usar o site.
//
// Usa axios puro (não a instância de services/api.ts) para não cair no
// interceptor de 401 de lá, que é quem chama esta função.
import axios from "axios";
import { decodeToken } from "./jwt";
import { getRefreshToken, getToken, setRefreshToken, setToken } from "./storage";
import type { AuthResponse } from "./types/loja";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Renova quando faltar menos que isso para o token de acesso vencer.
export const MARGEM_RENOVACAO_MS = 60 * 1000;

// Uma renovação por vez nesta aba: várias chamadas recebendo 401 juntas
// esperam a mesma renovação, em vez de cada uma gastar o refresh token.
let renovacaoEmAndamento: Promise<boolean> | null = null;

function precisaRenovar(token: string | null): boolean {
  const exp = decodeToken(token)?.exp;
  if (!exp) return true;
  return exp * 1000 - Date.now() < MARGEM_RENOVACAO_MS;
}

async function renovar(): Promise<boolean> {
  // Outra aba pode ter renovado enquanto esta esperava a trava.
  if (!precisaRenovar(getToken())) return true;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const { data } = await axios.post<AuthResponse>(`${API_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    setToken(data.access_token);
    setRefreshToken(data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// Devolve true se a sessão continua válida (renovada agora ou por outra
// aba) e false se não deu para renovar — aí quem chamou encerra a sessão.
export function renovarSessao(): Promise<boolean> {
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = renovarEntreAbas().finally(() => {
      renovacaoEmAndamento = null;
    });
  }
  return renovacaoEmAndamento;
}

// Trava entre abas (Web Locks): o backend trata um refresh token usado duas
// vezes como roubo e derruba TODAS as sessões da pessoa. Com duas abas
// abertas renovando ao mesmo tempo, isso aconteceria — a trava faz a
// segunda aba esperar e reaproveitar o token que a primeira já gravou.
async function renovarEntreAbas(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return await navigator.locks.request("sensora-renovar-sessao", renovar);
  }
  return renovar();
}

// Logout: invalida o refresh token no backend. Sem await de propósito —
// a sessão local já foi limpa e uma falha aqui não pode travar o "Sair".
export function revogarSessaoNoServidor(refreshToken: string | null): void {
  if (!refreshToken) return;
  axios.post(`${API_URL}/auth/logout`, { refresh_token: refreshToken }).catch(() => {});
}
