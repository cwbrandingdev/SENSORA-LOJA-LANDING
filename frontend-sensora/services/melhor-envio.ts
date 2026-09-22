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
  VerificacaoOperacionalResponse,
} from "@/lib/types/loja";

export async function buscarStatusMelhorEnvio(): Promise<MelhorEnvioStatusResponse> {
  const response = await api.get<MelhorEnvioStatusResponse>("/admin/melhor-envio/status");
  return response.data;
}

export async function obterUrlConexaoMelhorEnvio(): Promise<MelhorEnvioConectarResponse> {
  const response = await api.get<MelhorEnvioConectarResponse>("/admin/melhor-envio/conectar");
  return response.data;
}

// Vistoria das Integrações (Admin) — verificação real sob demanda (botão
// "Verificar agora"), GET .../verificar, DIFERENTE de buscarStatusMelhorEnvio
// (que só reflete configuração/token salvo, nunca chama o Melhor Envio de
// verdade). Read-only, sem nenhum efeito colateral — nunca cota frete.
export async function verificarMelhorEnvio(): Promise<VerificacaoOperacionalResponse> {
  const response = await api.get<VerificacaoOperacionalResponse>("/admin/melhor-envio/verificar");
  return response.data;
}
