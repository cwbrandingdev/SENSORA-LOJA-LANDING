// Mesmo padrão de services/clientes.ts, services/produtos.ts etc. — usa a
// instância `api` (Authorization automático via interceptor, ver
// services/api.ts). Só as duas operações que esta task precisa: listar e
// cadastrar (backend também expõe GET/:id, PUT/:id, DELETE/:id, mas nada
// aqui os usa ainda).
import api from "./api";
import type { CreateEnderecoPayload, Endereco } from "@/lib/types/loja";

export async function listarEnderecos(): Promise<Endereco[]> {
  const response = await api.get<Endereco[]>("/enderecos");
  return response.data;
}

export async function criarEndereco(data: CreateEnderecoPayload): Promise<Endereco> {
  const response = await api.post<Endereco>("/enderecos", data);
  return response.data;
}
