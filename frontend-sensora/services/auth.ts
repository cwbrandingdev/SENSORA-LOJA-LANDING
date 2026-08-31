// Portado de frontend/services/auth.js.
// register() retorna o usuário criado (UsuarioPublico), não um token —
// conferido em backend/src/auth/auth.service.ts: o registro não autentica
// automaticamente, só cria o usuário com perfil CLIENTE.
import api from "./api";
import type { AuthResponse, LoginPayload, RegisterPayload, Usuario } from "@/lib/types/loja";

export async function login(data: LoginPayload): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/login", data);
  return response.data;
}

export async function register(data: RegisterPayload): Promise<Usuario> {
  const response = await api.post<Usuario>("/auth/register", data);
  return response.data;
}
