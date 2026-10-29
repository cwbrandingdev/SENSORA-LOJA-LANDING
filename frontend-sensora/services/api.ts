// Portado de frontend/services/api.js — mesma instância axios, mesmo
// interceptor de Authorization. Baseado em NEXT_PUBLIC_API_URL, igual à
// Loja original e ao lib/api-publica.ts já existente na Landing.
import axios, { isAxiosError, type InternalAxiosRequestConfig } from "axios";
import { getToken, removeToken } from "@/lib/storage";
import { renovarSessao } from "@/lib/sessao";
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

// Marca a chamada que já foi repetida depois de renovar a sessão — um 2º 401
// nela não tenta renovar de novo (evita repetir para sempre). O axios copia
// essa propriedade para a config da repetição.
type ConfigComRenovacao = InternalAxiosRequestConfig & { _sessaoRenovada?: boolean };

// Sessão expirada/token inválido: qualquer 401 nesta instância (fora do
// próprio fluxo de /auth/*, onde 401 é resposta normal de credenciais
// erradas, não de sessão expirada) primeiro tenta renovar a sessão e
// repetir a chamada; só se não der, limpa o token e força volta pro login.
// Só 401 — 403 (RolesGuard, perfil sem permissão) passa direto, cada tela
// já trata isso com sua própria mensagem de erro.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url ?? "";
    const isSessaoExpirada =
      isAxiosError(error) &&
      error.response?.status === 401 &&
      !url.startsWith("/auth/") &&
      // Sync de sacola é em segundo plano: um 401 aqui (token de teste E2E,
      // JWT inválido ainda não expirado no client) não pode expulsar quem
      // só está navegando a loja. Checkout e Minha Conta continuam
      // redirecionando no 401.
      !url.startsWith("/carrinho");

    // O interceptor de request põe o token novo no Authorization ao repetir.
    const config = error.config as ConfigComRenovacao | undefined;
    if (isSessaoExpirada && config && !config._sessaoRenovada) {
      config._sessaoRenovada = true;
      if (await renovarSessao()) {
        return api(config);
      }
    }

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
