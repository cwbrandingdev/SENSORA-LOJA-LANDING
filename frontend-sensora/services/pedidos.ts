// Portado de frontend/services/pedidos.js — mesmos endpoints e métodos.
import api from "./api";
import type {
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

// Etapa 8.1 (complemento — eliminação da venda manual) — criarPedido() foi
// removido de propósito: POST /pedidos não existe mais no backend
// (PedidosController não tem handler `create`). Toda venda nasce
// exclusivamente do fluxo Carrinho -> Checkout (ver services/checkout.ts).

export async function atualizarPedido(id: number, data: UpdatePedidoPayload): Promise<Pedido> {
  const response = await api.put<Pedido>(`/pedidos/${id}`, data);
  return response.data;
}

export async function removerPedido(id: number): Promise<void> {
  await api.delete(`/pedidos/${id}`);
}

// Etapa 6.6 (Status de Envio) — POST /pedidos/:id/marcar-enviado, mesmo
// padrão de cancelarMeuPedido/solicitarReembolsoMeuPedido acima: operação
// específica, sem body (a única transição possível é NAO_ENVIADO ->
// ENVIADO; a regra "só a partir de PAGO", a idempotência e o claim atômico
// contra corrida são inteiramente resolvidos no backend, ver
// PedidosService.marcarComoEnviado).
export async function marcarPedidoComoEnviado(id: number): Promise<Pedido> {
  const response = await api.post<Pedido>(`/pedidos/${id}/marcar-enviado`);
  return response.data;
}
