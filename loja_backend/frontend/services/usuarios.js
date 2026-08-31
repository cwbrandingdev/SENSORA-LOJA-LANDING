import api from "./api";

export async function listarUsuarios() {
  const response = await api.get("/usuarios");
  return response.data;
}

export async function buscarUsuario(id) {
  const response = await api.get(`/usuarios/${id}`);
  return response.data;
}

export async function criarUsuario(data) {
  const response = await api.post("/usuarios", data);
  return response.data;
}

export async function atualizarUsuario(id, data) {
  const response = await api.put(`/usuarios/${id}`, data);
  return response.data;
}

export async function removerUsuario(id) {
  await api.delete(`/usuarios/${id}`);
}
