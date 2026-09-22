// Portado de frontend/services/usuarios.js — mesmos endpoints e métodos.
import api from "./api";
import type {
  ClienteDetalhado,
  CreateUsuarioPayload,
  UpdateUsuarioPayload,
  Usuario,
} from "@/lib/types/loja";

export async function listarUsuarios(): Promise<Usuario[]> {
  const response = await api.get<Usuario[]>("/usuarios");
  return response.data;
}

export async function buscarUsuario(id: number): Promise<Usuario> {
  const response = await api.get<Usuario>(`/usuarios/${id}`);
  return response.data;
}

// Fase B (Admin/Clientes reais) — GET /usuarios/:id/detalhes
// (backend/src/usuarios/usuarios.controller.ts). ADMIN-only, 404 quando o
// usuário não existe ou não tem perfil CLIENTE (ver UsuariosService.
// buscarDetalheCliente) — mesmo tratamento de erro genérico já usado pelo
// resto do Admin (getErrorMessage/isAxiosError no chamador).
export async function buscarDetalheCliente(id: number): Promise<ClienteDetalhado> {
  const response = await api.get<ClienteDetalhado>(`/usuarios/${id}/detalhes`);
  return response.data;
}

export async function criarUsuario(data: CreateUsuarioPayload): Promise<Usuario> {
  const response = await api.post<Usuario>("/usuarios", data);
  return response.data;
}

export async function atualizarUsuario(id: number, data: UpdateUsuarioPayload): Promise<Usuario> {
  const response = await api.put<Usuario>(`/usuarios/${id}`, data);
  return response.data;
}

export async function removerUsuario(id: number): Promise<void> {
  await api.delete(`/usuarios/${id}`);
}
