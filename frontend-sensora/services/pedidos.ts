// Portado de frontend/services/pedidos.js — mesmos endpoints e métodos.
import api from "./api";
import type {
  Devolucao,
  DevolucoesDoPedido,
  EvidenciaDevolucao,
  Pedido,
  PedidoComItens,
  PedidoComItensDetalhado,
  SolicitarDevolucaoPayload,
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

// Etapa 4 (Devoluções) — POST /pedidos/meus/:id/devolucoes, para pedido
// PAGO já ENVIADO. O backend valida dono, status, itens e quantidades
// disponíveis; daqui só saem motivo, descrição e itens/quantidades.
export async function solicitarDevolucaoMeuPedido(
  id: number,
  data: SolicitarDevolucaoPayload,
): Promise<Devolucao> {
  const response = await api.post<Devolucao>(`/pedidos/meus/${id}/devolucoes`, data);
  return response.data;
}

// Etapa 6 — histórico de devoluções do próprio pedido (mais recentes
// primeiro, com fotos em URLs assinadas de validade curta) e o saldo de
// cada item, calculado no backend.
export async function listarMinhasDevolucoes(pedidoId: number): Promise<DevolucoesDoPedido> {
  const response = await api.get<DevolucoesDoPedido>(`/pedidos/meus/${pedidoId}/devolucoes`);
  return response.data;
}

// Uma foto por requisição, no campo "foto". Pasta, nome e privacidade no
// ImageKit são decididos pelo backend; formato e tamanho são conferidos lá.
// "multipart/form-data" aqui faz o axios enviar o FormData como está (o
// navegador completa o boundary) — com o padrão JSON do `api`, ele seria
// convertido em JSON. Timeout maior: a foto pode ter até 5 MB.
export async function enviarEvidenciaDevolucao(
  pedidoId: number,
  devolucaoId: number,
  foto: File,
): Promise<EvidenciaDevolucao> {
  const formData = new FormData();
  formData.append("foto", foto);
  const response = await api.post<EvidenciaDevolucao>(
    `/pedidos/meus/${pedidoId}/devolucoes/${devolucaoId}/evidencias`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 },
  );
  return response.data;
}

// Etapa 8 — recurso secundário: URL do documento do envio da devolução,
// gerada na hora pelo backend (só o dono, só enquanto a devolução aguarda o
// envio). Nunca guardada. O fluxo principal é o código de devolução.
export async function urlDocumentoEnvioMinhaDevolucao(
  pedidoId: number,
  devolucaoId: number,
): Promise<string> {
  const response = await api.get<{ url: string }>(
    `/pedidos/meus/${pedidoId}/devolucoes/${devolucaoId}/documento`,
  );
  return response.data.url;
}

export async function removerEvidenciaDevolucao(
  pedidoId: number,
  devolucaoId: number,
  evidenciaId: number,
): Promise<void> {
  await api.delete(
    `/pedidos/meus/${pedidoId}/devolucoes/${devolucaoId}/evidencias/${evidenciaId}`,
  );
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
export async function marcarPedidoComoEnviado(
  id: number,
  codigoRastreio?: string,
): Promise<Pedido> {
  const codigo = codigoRastreio?.trim();
  const response = await api.post<Pedido>(
    `/pedidos/${id}/marcar-enviado`,
    codigo ? { codigoRastreio: codigo } : {},
  );
  return response.data;
}

export async function atualizarEnderecoMeuPedido(
  id: number,
  enderecoId: number,
): Promise<Pedido> {
  const response = await api.patch<Pedido>(`/pedidos/meus/${id}/endereco`, {
    enderecoId,
  });
  return response.data;
}
