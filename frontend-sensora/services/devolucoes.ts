// Etapa 7 — análise das devoluções no Workspace-X (rotas /admin/devolucoes,
// só ADMIN). Quem analisou é sempre definido pelo backend a partir do
// token; daqui só sai a observação.
import api from "./api";
import type { DevolucaoAnalise, DevolucaoResumoAdmin } from "@/lib/types/loja";

export async function listarDevolucoesAdmin(status?: string): Promise<DevolucaoResumoAdmin[]> {
  const response = await api.get<DevolucaoResumoAdmin[]>("/admin/devolucoes", {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function buscarDevolucaoAdmin(id: number): Promise<DevolucaoAnalise> {
  const response = await api.get<DevolucaoAnalise>(`/admin/devolucoes/${id}`);
  return response.data;
}

export async function aprovarDevolucao(
  id: number,
  observacao?: string,
): Promise<DevolucaoAnalise> {
  const response = await api.post<DevolucaoAnalise>(
    `/admin/devolucoes/${id}/aprovar`,
    observacao ? { observacao } : {},
  );
  return response.data;
}

export async function recusarDevolucao(
  id: number,
  observacao: string,
): Promise<DevolucaoAnalise> {
  const response = await api.post<DevolucaoAnalise>(`/admin/devolucoes/${id}/recusar`, {
    observacao,
  });
  return response.data;
}
