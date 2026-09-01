// Mesmo padrão de services/clientes.ts, services/produtos.ts etc. — usa a
// instância `api` (Authorization automático via interceptor, ver
// services/api.ts). listarEnderecos/criarEndereco já existiam (Task 8,
// checkout); atualizarEndereco/removerEndereco são novos (Etapa 4, Minha
// Conta / Endereços) — o backend já expunha PUT/:id e DELETE/:id desde o
// início, só não havia consumidor no frontend ainda.
import api from "./api";
import type { CreateEnderecoPayload, Endereco, UpdateEnderecoPayload } from "@/lib/types/loja";

export async function listarEnderecos(): Promise<Endereco[]> {
  const response = await api.get<Endereco[]>("/enderecos");
  return response.data;
}

export async function criarEndereco(data: CreateEnderecoPayload): Promise<Endereco> {
  const response = await api.post<Endereco>("/enderecos", data);
  return response.data;
}

export async function atualizarEndereco(
  id: number,
  data: UpdateEnderecoPayload,
): Promise<Endereco> {
  const response = await api.put<Endereco>(`/enderecos/${id}`, data);
  return response.data;
}

export async function removerEndereco(id: number): Promise<void> {
  await api.delete(`/enderecos/${id}`);
}
