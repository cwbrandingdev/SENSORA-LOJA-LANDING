// Etapa 6.5 (Painel administrativo) — mesmo padrão de services/checkout.ts e
// services/frete.ts: instância `api` (Authorization automático via
// interceptor, ver services/api.ts), sem nenhum mecanismo de autenticação
// paralelo. Só encaminha para os endpoints STAFF-only já existentes no
// backend (JwtAuthGuard + RolesGuard, ver melhor-envio.controller.ts) — a
// UI nunca decide sozinha quem pode conectar, o backend continua sendo a
// autoridade final.
import api from "./api";
import type {
  MelhorEnvioConectarResponse,
  MelhorEnvioStatusResponse,
} from "@/lib/types/loja";

export async function buscarStatusMelhorEnvio(): Promise<MelhorEnvioStatusResponse> {
  const response = await api.get<MelhorEnvioStatusResponse>("/admin/melhor-envio/status");
  return response.data;
}

export async function obterUrlConexaoMelhorEnvio(): Promise<MelhorEnvioConectarResponse> {
  const response = await api.get<MelhorEnvioConectarResponse>("/admin/melhor-envio/conectar");
  return response.data;
}
