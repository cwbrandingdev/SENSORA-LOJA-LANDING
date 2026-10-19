// Avaliações de produto: o cliente avalia os produtos de um pedido dele (a
// partir da data prevista de entrega); o Admin aprova ou recusa. A leitura
// pública fica em lib/api-publica.ts (buscarAvaliacoesDoProduto).
import api from "./api";
import type {
  AvaliacaoAdmin,
  AvaliacaoDoCliente,
  AvaliacoesDoPedido,
  StatusAvaliacao,
} from "@/lib/types/loja";

export async function listarAvaliacoesDoPedido(pedidoId: number): Promise<AvaliacoesDoPedido> {
  const response = await api.get<AvaliacoesDoPedido>(`/avaliacoes/pedido/${pedidoId}`);
  return response.data;
}

export async function salvarAvaliacao(
  pedidoId: number,
  produtoId: number,
  dados: { nota: number; comentario?: string },
): Promise<AvaliacaoDoCliente> {
  const response = await api.put<AvaliacaoDoCliente>(
    `/avaliacoes/pedido/${pedidoId}/produto/${produtoId}`,
    dados,
  );
  return response.data;
}

export async function listarAvaliacoesAdmin(status?: StatusAvaliacao): Promise<AvaliacaoAdmin[]> {
  const response = await api.get<AvaliacaoAdmin[]>("/admin/avaliacoes", {
    params: status ? { status } : {},
  });
  return response.data;
}

export async function atualizarStatusAvaliacao(
  id: number,
  status: Exclude<StatusAvaliacao, "PENDENTE">,
): Promise<void> {
  await api.patch(`/admin/avaliacoes/${id}/status`, { status });
}
