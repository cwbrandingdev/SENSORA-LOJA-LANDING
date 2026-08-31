// Portado de frontend/services/api.js — mesma instância axios, mesmo
// interceptor de Authorization. Baseado em NEXT_PUBLIC_API_URL, igual à
// Loja original e ao lib/api-publica.ts já existente na Landing.
import axios, { isAxiosError } from "axios";
import { getToken, removeToken } from "@/lib/storage";
import { loginComRedirect } from "@/lib/auth-redirect";
import { ROUTES } from "@/lib/routes";

// Timeout (Task 18): evita tela travada indefinidamente se o backend cair
// ou travar. 15s cobre mutações administrativas (validação no backend),
// diferente do timeout de 8s da API pública em lib/api-publica.ts, que só
// faz leituras simples cacheadas. Um erro de timeout não tem `error.response`
// (ver interceptor abaixo), então nunca é confundido com 401/sessão expirada.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Sessão expirada/token inválido: qualquer 401 nesta instância (fora do
// próprio fluxo de /auth/*, onde 401 é resposta normal de credenciais
// erradas, não de sessão expirada) limpa o token e força volta pro login.
// Só 401 — 403 (RolesGuard, perfil sem permissão) passa direto, cada tela
// já trata isso com sua própria mensagem de erro.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isSessaoExpirada =
      isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.startsWith("/auth/");

    if (
      isSessaoExpirada &&
      typeof window !== "undefined" &&
      window.location.pathname !== ROUTES.LOGIN
    ) {
      removeToken();
      // Task 16: preserva a página atual como destino de retorno (mesmo
      // helper que /loja/carrinho e /loja/checkout já usam) — sem isso, um
      // 401 durante o checkout (ex.: token expirou entre carregar a página
      // e clicar em "Continuar para pagamento") jogava o cliente pro login
      // sem nenhuma forma de voltar exatamente pra onde estava depois de
      // autenticar de novo.
      window.location.href = loginComRedirect(window.location.pathname);
    }

    return Promise.reject(error);
  },
);

export default api;
