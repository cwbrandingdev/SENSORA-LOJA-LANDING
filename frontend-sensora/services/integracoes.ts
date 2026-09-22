// Central de Integrações (Admin) — mesmo padrão de services/melhor-envio.ts:
// instância `api` (Authorization automático via interceptor, ver
// services/api.ts), sem mecanismo de autenticação paralelo. Cada função só
// encaminha para o endpoint ADMIN-only já existente no backend
// (JwtAuthGuard + RolesGuard(ADMIN_ONLY_ROLES) — ver
// asaas.controller.ts/mail.controller.ts/imagekit.controller.ts). As
// funções `verificar*` chamam um endpoint DIFERENTE do `status` (GET
// .../verificar) — verificação real sob demanda, só disparada quando o
// admin clica em "Verificar agora" (ver IntegracaoStatusCard.tsx), nunca
// automática.
import api from "./api";
import type {
  AsaasStatusResponse,
  ImagekitStatusResponse,
  ResendStatusResponse,
  VerificacaoOperacionalResponse,
} from "@/lib/types/loja";

export async function buscarStatusAsaas(): Promise<AsaasStatusResponse> {
  const response = await api.get<AsaasStatusResponse>("/admin/asaas/status");
  return response.data;
}

export async function verificarAsaas(): Promise<VerificacaoOperacionalResponse> {
  const response = await api.get<VerificacaoOperacionalResponse>("/admin/asaas/verificar");
  return response.data;
}

// Resend já foi validado em produção com envio real — esta função continua
// baseada só em configuração (GET /admin/mail/status), sem nenhum endpoint
// de verificação ao vivo (nenhum e-mail é disparado por esta tela).
export async function buscarStatusResend(): Promise<ResendStatusResponse> {
  const response = await api.get<ResendStatusResponse>("/admin/mail/status");
  return response.data;
}

export async function buscarStatusImagekit(): Promise<ImagekitStatusResponse> {
  const response = await api.get<ImagekitStatusResponse>("/imagekit/status");
  return response.data;
}

export async function verificarImagekit(): Promise<VerificacaoOperacionalResponse> {
  const response = await api.get<VerificacaoOperacionalResponse>("/imagekit/verificar");
  return response.data;
}
