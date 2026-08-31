// Portado de frontend/services/clientes.js — mesmos endpoints e métodos.
import api from "./api";
import type { Cliente, CreateClientePayload, UpdateClientePayload } from "@/lib/types/loja";

export async function listarClientes(): Promise<Cliente[]> {
  const response = await api.get<Cliente[]>("/clientes");
  return response.data;
}

export async function buscarCliente(id: number): Promise<Cliente> {
  const response = await api.get<Cliente>(`/clientes/${id}`);
  return response.data;
}

export async function criarCliente(data: CreateClientePayload): Promise<Cliente> {
  const response = await api.post<Cliente>("/clientes", data);
  return response.data;
}

export async function atualizarCliente(id: number, data: UpdateClientePayload): Promise<Cliente> {
  const response = await api.put<Cliente>(`/clientes/${id}`, data);
  return response.data;
}

export async function removerCliente(id: number): Promise<void> {
  await api.delete(`/clientes/${id}`);
}
