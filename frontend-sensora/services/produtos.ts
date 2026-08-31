// Portado de frontend/services/produtos.js — mesmos endpoints e métodos.
import api from "./api";
import type { CreateProdutoPayload, Produto, UpdateProdutoPayload } from "@/lib/types/loja";

export async function listarProdutos(): Promise<Produto[]> {
  const response = await api.get<Produto[]>("/produtos");
  return response.data;
}

export async function buscarProduto(id: number): Promise<Produto> {
  const response = await api.get<Produto>(`/produtos/${id}`);
  return response.data;
}

export async function criarProduto(data: CreateProdutoPayload): Promise<Produto> {
  const response = await api.post<Produto>("/produtos", data);
  return response.data;
}

export async function atualizarProduto(id: number, data: UpdateProdutoPayload): Promise<Produto> {
  const response = await api.put<Produto>(`/produtos/${id}`, data);
  return response.data;
}

export async function removerProduto(id: number): Promise<void> {
  await api.delete(`/produtos/${id}`);
}
