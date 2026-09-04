// Portado de frontend/services/itensPedido.js — mesmos endpoints e métodos.
import api from "./api";
import type { ItemPedido, UpdateItemPedidoPayload } from "@/lib/types/loja";

export async function listarItensPedido(): Promise<ItemPedido[]> {
  const response = await api.get<ItemPedido[]>("/itens-pedido");
  return response.data;
}

export async function buscarItemPedido(id: number): Promise<ItemPedido> {
  const response = await api.get<ItemPedido>(`/itens-pedido/${id}`);
  return response.data;
}

// Etapa 8.1 (complemento — eliminação da venda manual) — criarItemPedido()
// foi removido de propósito: POST /itens-pedido não existe mais no backend
// (ItensPedidoController não tem handler `create`). Itens de pedido nascem
// exclusivamente dentro de CheckoutService.createSession.

export async function atualizarItemPedido(id: number, data: UpdateItemPedidoPayload): Promise<ItemPedido> {
  const response = await api.put<ItemPedido>(`/itens-pedido/${id}`, data);
  return response.data;
}

export async function removerItemPedido(id: number): Promise<void> {
  await api.delete(`/itens-pedido/${id}`);
}
