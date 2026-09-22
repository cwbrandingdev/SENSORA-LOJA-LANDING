// Vistoria do Dashboard operacional (Admin) — GET /dashboard/resumo
// (backend/src/dashboard/dashboard.controller.ts). ADMIN-only (decisão
// explícita do pedido — diferente de STAFF_ROLES usado por
// services/pedidos.ts, produtos.ts e categorias.ts): VENDEDOR autenticado
// recebe 403 desta chamada especificamente, tratado pela tela do Dashboard
// como o mesmo estado de erro já existente por card (ver MetricCard), nunca
// como uma exceção não tratada.
import api from "./api";
import type { DashboardResumo } from "@/lib/types/loja";

export async function buscarResumoDashboard(): Promise<DashboardResumo> {
  const response = await api.get<DashboardResumo>("/dashboard/resumo");
  return response.data;
}
