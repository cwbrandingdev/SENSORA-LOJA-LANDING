import api from "./api";

export async function listarItensPedido() {
  const response = await api.get("/itens-pedido");
  return response.data;
}

export async function buscarItemPedido(id) {
  const response = await api.get(`/itens-pedido/${id}`);
  return response.data;
}

export async function criarItemPedido(data) {
  const response = await api.post("/itens-pedido", data);
  return response.data;
}

export async function atualizarItemPedido(id, data) {
  const response = await api.put(`/itens-pedido/${id}`, data);
  return response.data;
}

export async function removerItemPedido(id) {
  await api.delete(`/itens-pedido/${id}`);
}
