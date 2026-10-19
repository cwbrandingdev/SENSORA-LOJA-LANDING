// Vistoria do Dashboard operacional (Admin) — GET /dashboard/resumo
// (backend/src/dashboard/dashboard.controller.ts). ADMIN-only (decisão
// explícita do pedido — diferente de STAFF_ROLES usado por
// services/pedidos.ts, produtos.ts e categorias.ts): VENDEDOR autenticado
// recebe 403 desta chamada especificamente, tratado pela tela do Dashboard
// como o mesmo estado de erro já existente por card (ver MetricCard), nunca
// como uma exceção não tratada.
import api from "./api";
import type { DashboardResumo, DashboardResumoMensal } from "@/lib/types/loja";

export async function buscarResumoDashboard(): Promise<DashboardResumo> {
  const response = await api.get<DashboardResumo>("/dashboard/resumo");
  return response.data;
}

export type BuscarResumoMensalParams = {
  ano?: number;
  mes?: number;
  compararAno?: number;
  compararMes?: number;
};

export async function buscarResumoMensal(
  params: BuscarResumoMensalParams = {},
): Promise<DashboardResumoMensal> {
  const query = new URLSearchParams();
  if (params.ano !== undefined) query.set("ano", String(params.ano));
  if (params.mes !== undefined) query.set("mes", String(params.mes));
  if (params.compararAno !== undefined) {
    query.set("compararAno", String(params.compararAno));
  }
  if (params.compararMes !== undefined) {
    query.set("compararMes", String(params.compararMes));
  }
  const qs = query.toString();
  const response = await api.get<DashboardResumoMensal>(
    `/dashboard/resumo-mensal${qs ? `?${qs}` : ""}`,
  );
  return response.data;
}
