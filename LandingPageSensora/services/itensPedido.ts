// Portado de frontend/services/itensPedido.js — mesmos endpoints e métodos.
import api from "./api";
import type { CreateItemPedidoPayload, ItemPedido, UpdateItemPedidoPayload } from "@/lib/types/loja";

export async function listarItensPedido(): Promise<ItemPedido[]> {
  const response = await api.get<ItemPedido[]>("/itens-pedido");
  return response.data;
}

export async function buscarItemPedido(id: number): Promise<ItemPedido> {
  const response = await api.get<ItemPedido>(`/itens-pedido/${id}`);
  return response.data;
}

export async function criarItemPedido(data: CreateItemPedidoPayload): Promise<ItemPedido> {
  const response = await api.post<ItemPedido>("/itens-pedido", data);
  return response.data;
}

export async function atualizarItemPedido(id: number, data: UpdateItemPedidoPayload): Promise<ItemPedido> {
  const response = await api.put<ItemPedido>(`/itens-pedido/${id}`, data);
  return response.data;
}

export async function removerItemPedido(id: number): Promise<void> {
  await api.delete(`/itens-pedido/${id}`);
}
