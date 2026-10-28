// Carrinho da conta autenticada — GET/PUT /carrinho. A UI continua lendo
// o localStorage na hora; esta API é a cópia no banco (lembrete de sacola
// abandonada e sacola entre aparelhos). Falha de rede nunca deve quebrar
// adicionar/remover item: quem chama engole o erro.
import api from "./api";
import type { Carrinho, ItemCarrinho } from "@/lib/types/loja";

export type ItemCarrinhoPayload = {
  produtoId: number;
  quantidade: number;
};

export async function buscarCarrinho(): Promise<ItemCarrinho[]> {
  const response = await api.get<Carrinho>("/carrinho");
  return Array.isArray(response.data?.itens) ? response.data.itens : [];
}

export async function salvarCarrinho(
  itens: ItemCarrinhoPayload[],
): Promise<void> {
  await api.put<Carrinho>("/carrinho", { itens });
}
