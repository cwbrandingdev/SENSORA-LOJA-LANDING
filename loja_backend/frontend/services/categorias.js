import api from "./api";

export async function listarCategorias() {
  const response = await api.get("/categorias");
  return response.data;
}

export async function buscarCategoria(id) {
  const response = await api.get(`/categorias/${id}`);
  return response.data;
}

export async function criarCategoria(data) {
  const response = await api.post("/categorias", data);
  return response.data;
}

export async function atualizarCategoria(id, data) {
  const response = await api.put(`/categorias/${id}`, data);
  return response.data;
}

export async function removerCategoria(id) {
  await api.delete(`/categorias/${id}`);
}
