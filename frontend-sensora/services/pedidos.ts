// Portado de frontend/services/pedidos.js — mesmos endpoints e métodos.
import api from "./api";
import type {
  CreatePedidoPayload,
  Pedido,
  PedidoComItens,
  PedidoComItensDetalhado,
  UpdatePedidoPayload,
} from "@/lib/types/loja";

// Etapa 2 (Minha Conta / Meus Pedidos) — GET /pedidos/meus e
// GET /pedidos/meus/:id (backend/src/pedidos/pedidos.controller.ts), rotas
// de autoatendimento distintas das acima: qualquer usuário autenticado
// (CLIENTE incluso) só recebe os PRÓPRIOS pedidos, nunca de outro usuário —
// ownership é sempre resolvido no backend a partir do token, nunca de um
// parâmetro enviado aqui.
export async function listarMeusPedidos(): Promise<Pedido[]> {
  const response = await api.get<Pedido[]>("/pedidos/meus");
  return response.data;
}

export async function buscarMeuPedido(id: number): Promise<PedidoComItensDetalhado> {
  const response = await api.get<PedidoComItensDetalhado>(`/pedidos/meus/${id}`);
  return response.data;
}

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
