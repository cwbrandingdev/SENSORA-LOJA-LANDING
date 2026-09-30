// Etapa 7 — análise das devoluções no Workspace-X (rotas /admin/devolucoes,
// só ADMIN). Quem analisou é sempre definido pelo backend a partir do
// token; daqui só sai a observação.
import api from "./api";
import type {
  DevolucaoAnalise,
  DevolucaoResumoAdmin,
  OpcaoFreteDevolucao,
} from "@/lib/types/loja";

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

// Etapa 8 — logística reversa (só ADMIN). O envio é pago com o saldo da
// carteira do Melhor Envio; preço e transportadora são sempre conferidos no
// backend — daqui só saem o serviço escolhido e o custo que o ADMIN
// confirmou (teto: a compra nunca debita mais do que isso).
export async function cotarFreteDevolucao(id: number): Promise<OpcaoFreteDevolucao[]> {
  const response = await api.get<OpcaoFreteDevolucao[]>(`/admin/devolucoes/${id}/frete-devolucao`);
  return response.data;
}

// Gera (ou retoma) a logística reversa — é o que libera o código de
// devolução. Timeout maior: são várias chamadas ao Melhor Envio (criar,
// comprar, gerar).
export async function gerarLogisticaDevolucao(
  id: number,
  servicoId: number,
  custoConfirmado: number,
): Promise<DevolucaoAnalise> {
  const response = await api.post<DevolucaoAnalise>(
    `/admin/devolucoes/${id}/logistica`,
    { servicoId, custoConfirmado },
    { timeout: 60000 },
  );
  return response.data;
}

// Recurso secundário: documento do envio. URL gerada na hora pelo backend;
// nunca guardada.
export async function urlDocumentoEnvioDevolucaoAdmin(id: number): Promise<string> {
  const response = await api.get<{ url: string }>(`/admin/devolucoes/${id}/documento`);
  return response.data.url;
}

export async function atualizarRastreioDevolucao(id: number): Promise<DevolucaoAnalise> {
  const response = await api.post<DevolucaoAnalise>(`/admin/devolucoes/${id}/rastreio`);
  return response.data;
}

export async function confirmarRecebimentoDevolucao(id: number): Promise<DevolucaoAnalise> {
  const response = await api.post<DevolucaoAnalise>(`/admin/devolucoes/${id}/recebida`);
  return response.data;
}
