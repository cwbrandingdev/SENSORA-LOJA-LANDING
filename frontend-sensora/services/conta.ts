// Etapa 3 (Minha Conta / Dados Pessoais + Segurança) — autoatendimento do
// próprio usuário autenticado. Deliberadamente separado de services/
// usuarios.ts (CRUD administrativo, ADMIN-only, hits /usuarios com
// UpdateUsuarioPayload que inclui perfil/ativo/senha) para nunca confundir
// os dois: aqui só GET/PUT /usuarios/me (whitelist nome/email) e
// POST /auth/change-password (senhaAtual/novaSenha). O usuarioId nunca é
// passado por aqui — o backend sempre o extrai do token (@CurrentUser()).
import api from "./api";
import type {
  AlterarMinhaSenhaPayload,
  AtualizarMeusDadosPayload,
  MessageResponse,
  Usuario,
} from "@/lib/types/loja";

export async function buscarMeuPerfil(): Promise<Usuario> {
  const response = await api.get<Usuario>("/usuarios/me");
  return response.data;
}

export async function atualizarMeuPerfil(
  data: AtualizarMeusDadosPayload,
): Promise<Usuario> {
  const response = await api.put<Usuario>("/usuarios/me", data);
  return response.data;
}

export async function alterarMinhaSenha(
  data: AlterarMinhaSenhaPayload,
): Promise<MessageResponse> {
  const response = await api.post<MessageResponse>("/auth/change-password", data);
  return response.data;
}
