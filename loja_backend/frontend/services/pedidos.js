import api from "./api";

export async function listarPedidos() {
  const response = await api.get("/pedidos");
  return response.data;
}

export async function buscarPedido(id) {
  const response = await api.get(`/pedidos/${id}`);
  return response.data;
}

export async function buscarPedidoComItens(id) {
  const response = await api.get(`/pedidos/${id}/itens`);
  return response.data;
}

export async function criarPedido(data) {
  const response = await api.post("/pedidos", data);
  return response.data;
}

export async function atualizarPedido(id, data) {
  const response = await api.put(`/pedidos/${id}`, data);
  return response.data;
}

export async function removerPedido(id) {
  await api.delete(`/pedidos/${id}`);
}
