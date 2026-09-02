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

// Etapa 5A (Cancelamento de Pedido) — POST /pedidos/meus/:id/cancelar,
// operação específica (não um PUT genérico): o backend só aceita a
// transição PENDENTE -> CANCELADO, nunca um status arbitrário enviado
// daqui. Ownership resolvido inteiramente no backend via @CurrentUser().
export async function cancelarMeuPedido(id: number): Promise<Pedido> {
  const response = await api.post<Pedido>(`/pedidos/meus/${id}/cancelar`);
  return response.data;
}

// Etapa 5B.7 (Solicitação de Reembolso) — POST /pedidos/meus/:id/cancelar-pago,
// mesmo padrão de cancelarMeuPedido: operação específica, sem body (o
// backend só aceita a transição PAGO -> REEMBOLSO_SOLICITADO, e resolve
// paymentId/ownership inteiramente a partir do token — nunca a partir de
// nada enviado por aqui). Ver PedidosService.solicitarReembolso
// (backend-sensora/src/pedidos/pedidos.service.ts).
export async function solicitarReembolsoMeuPedido(id: number): Promise<Pedido> {
  const response = await api.post<Pedido>(`/pedidos/meus/${id}/cancelar-pago`);
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
