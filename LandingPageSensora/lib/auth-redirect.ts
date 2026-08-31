// Controle de acesso ao fluxo de checkout — reaproveita as mesmas
// primitivas que o AuthContext já usa por baixo (getToken/isTokenExpired),
// sem passar pelo Context em si: AuthProvider só está montado em /admin e
// /login hoje, e seu efeito de auto-logout (sincronizarComToken) redireciona
// imediatamente para /login sem preservar destino — correto para o Admin,
// mas expulsaria visitantes anônimos com token expirado de qualquer página
// pública da Loja se fosse montado lá. Aqui só lemos o token, sem nenhum
// efeito colateral.
import { isTokenExpired } from "@/lib/jwt";
import { getToken } from "@/lib/storage";
import { ROUTES } from "@/lib/routes";

export function possuiSessaoValida(): boolean {
  const token = getToken();
  return Boolean(token) && !isTokenExpired(token);
}

// Só aceita caminhos internos começando com "/" — nunca uma URL absoluta
// nem "//host" (protocol-relative), o que abriria um open redirect via
// ?redirect=. Usado tanto para montar o link para /login quanto para
// validar o parâmetro lido de volta em app/login/page.tsx.
export function isDestinoInternoValido(destino: string | null): destino is string {
  return destino !== null && destino.startsWith("/") && !destino.startsWith("//");
}

export function loginComRedirect(destino: string): string {
  return `${ROUTES.LOGIN}?redirect=${encodeURIComponent(destino)}`;
}
