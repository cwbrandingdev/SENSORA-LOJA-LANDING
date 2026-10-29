// Vistoria de Alertas Operacionais (Admin) — mesmo padrão de
// services/dashboard.ts: instância `api` (Authorization automático via
// interceptor, ver services/api.ts), um único GET já agregado no backend
// (nenhuma lista completa de Pedido/Produto é baixada aqui para contar).
import api from "./api";
import type { Alerta, AlertaTipo } from "@/lib/types/loja";

export async function buscarAlertas(): Promise<Alerta[]> {
  const response = await api.get<Alerta[]>("/alertas");
  return response.data;
}

export async function excluirAlerta(tipo: AlertaTipo): Promise<void> {
  await api.delete(`/alertas/${tipo}`);
}
