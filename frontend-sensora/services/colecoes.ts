// Admin das coleções de datas festivas (backend: src/colecoes).
import api from "./api";
import type { Colecao, ColecaoPayload } from "@/lib/types/loja";

export async function listarColecoes(): Promise<Colecao[]> {
  const response = await api.get<Colecao[]>("/colecoes");
  return response.data;
}

export async function criarColecao(data: ColecaoPayload): Promise<Colecao> {
  const response = await api.post<Colecao>("/colecoes", data);
  return response.data;
}

export async function atualizarColecao(id: number, data: Partial<ColecaoPayload>): Promise<Colecao> {
  const response = await api.put<Colecao>(`/colecoes/${id}`, data);
  return response.data;
}

export async function removerColecao(id: number): Promise<void> {
  await api.delete(`/colecoes/${id}`);
}
