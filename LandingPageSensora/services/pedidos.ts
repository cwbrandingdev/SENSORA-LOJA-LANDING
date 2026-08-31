// Portado de frontend/services/pedidos.js — mesmos endpoints e métodos.
import api from "./api";
import type { CreatePedidoPayload, Pedido, PedidoComItens, UpdatePedidoPayload } from "@/lib/types/loja";

export async function listarPedidos(): Promise<Pedido[]> {
  const response = await api.get<Pedido[]>("/pedidos");
  return response.data;
}

export async function buscarPedido(id: number): Promise<Pedido> {
  const response = await api.get<Pedido>(`/pedidos/${id}`);
  return response.data;
}

export async function buscarPedidoComItens(id: number): Promise<PedidoComItens> {
  const response = await api.get<PedidoComItens>(`/pedidos/${id}/itens`);
  return response.data;
}

export async function criarPedido(data: CreatePedidoPayload): Promise<Pedido> {
  const response = await api.post<Pedido>("/pedidos", data);
  return response.data;
}

export async function atualizarPedido(id: number, data: UpdatePedidoPayload): Promise<Pedido> {
  const response = await api.put<Pedido>(`/pedidos/${id}`, data);
  return response.data;
}

export async function removerPedido(id: number): Promise<void> {
  await api.delete(`/pedidos/${id}`);
}
