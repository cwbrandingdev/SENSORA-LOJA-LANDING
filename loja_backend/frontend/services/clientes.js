import api from "./api";

export async function listarClientes() {
  const response = await api.get("/clientes");
  return response.data;
}

export async function buscarCliente(id) {
  const response = await api.get(`/clientes/${id}`);
  return response.data;
}

export async function criarCliente(data) {
  const response = await api.post("/clientes", data);
  return response.data;
}

export async function atualizarCliente(id, data) {
  const response = await api.put(`/clientes/${id}`, data);
  return response.data;
}

export async function removerCliente(id) {
  await api.delete(`/clientes/${id}`);
}
