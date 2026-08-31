import api from "./api";

export async function listarProdutos() {
  const response = await api.get("/produtos");
  return response.data;
}

export async function buscarProduto(id) {
  const response = await api.get(`/produtos/${id}`);
  return response.data;
}

export async function criarProduto(data) {
  const response = await api.post("/produtos", data);
  return response.data;
}

export async function atualizarProduto(id, data) {
  const response = await api.put(`/produtos/${id}`, data);
  return response.data;
}

export async function removerProduto(id) {
  await api.delete(`/produtos/${id}`);
}
