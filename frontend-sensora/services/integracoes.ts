// Central de Integrações (Admin) — mesmo padrão de services/melhor-envio.ts:
// instância `api` (Authorization automático via interceptor, ver
// services/api.ts), sem mecanismo de autenticação paralelo. Cada função só
// encaminha para o endpoint de status ADMIN-only já existente no backend
// (JwtAuthGuard + RolesGuard(ADMIN_ONLY_ROLES) — ver
// asaas.controller.ts/mail.controller.ts/imagekit.controller.ts).
import api from "./api";
import type { AsaasStatusResponse, IntegracaoStatusResponse } from "@/lib/types/loja";

export async function buscarStatusAsaas(): Promise<AsaasStatusResponse> {
  const response = await api.get<AsaasStatusResponse>("/admin/asaas/status");
  return response.data;
}

export async function buscarStatusResend(): Promise<IntegracaoStatusResponse> {
  const response = await api.get<IntegracaoStatusResponse>("/admin/mail/status");
  return response.data;
}

export async function buscarStatusImagekit(): Promise<IntegracaoStatusResponse> {
  const response = await api.get<IntegracaoStatusResponse>("/imagekit/status");
  return response.data;
}
