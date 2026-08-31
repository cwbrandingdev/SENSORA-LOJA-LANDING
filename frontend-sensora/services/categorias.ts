// Portado de frontend/services/categorias.js — mesmos endpoints e métodos.
import api from "./api";
import type { Categoria, CreateCategoriaPayload, UpdateCategoriaPayload } from "@/lib/types/loja";

export async function listarCategorias(): Promise<Categoria[]> {
  const response = await api.get<Categoria[]>("/categorias");
  return response.data;
}

export async function buscarCategoria(id: number): Promise<Categoria> {
  const response = await api.get<Categoria>(`/categorias/${id}`);
  return response.data;
}

export async function criarCategoria(data: CreateCategoriaPayload): Promise<Categoria> {
  const response = await api.post<Categoria>("/categorias", data);
  return response.data;
}

export async function atualizarCategoria(id: number, data: UpdateCategoriaPayload): Promise<Categoria> {
  const response = await api.put<Categoria>(`/categorias/${id}`, data);
  return response.data;
}

export async function removerCategoria(id: number): Promise<void> {
  await api.delete(`/categorias/${id}`);
}
