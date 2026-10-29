import api from "./api";
import type {
  Cupom,
  CupomAplicado,
  CupomCliente,
  FaixaCupom,
  SalvarCupomPayload,
} from "@/lib/types/loja";

export async function listarCupons(): Promise<Cupom[]> {
  const response = await api.get<Cupom[]>("/cupons");
  return response.data;
}

export async function criarCupom(data: SalvarCupomPayload): Promise<Cupom> {
  const response = await api.post<Cupom>("/cupons", data);
  return response.data;
}

export async function atualizarCupom(
  id: number,
  data: SalvarCupomPayload,
): Promise<Cupom> {
  const response = await api.put<Cupom>(`/cupons/${id}`, data);
  return response.data;
}

export async function removerCupom(id: number): Promise<void> {
  await api.delete(`/cupons/${id}`);
}

export async function buscarClientesCupom(busca: string): Promise<CupomCliente[]> {
  const response = await api.get<CupomCliente[]>("/cupons/clientes", {
    params: { busca },
  });
  return response.data;
}

export async function simularCupom(
  codigo: string,
  subtotal: number,
): Promise<CupomAplicado> {
  const response = await api.post<CupomAplicado>("/cupons/simular", {
    codigo,
    subtotal,
  });
  return response.data;
}

// Mesma faixa do SSR, mas com o token da conta — assim um cupom de cliente
// específico aparece para quem está logado.
export async function buscarFaixaCupom(): Promise<FaixaCupom | null> {
  const response = await api.get<{ faixa: FaixaCupom | null }>("/public/cupom-faixa");
  return response.data.faixa;
}
