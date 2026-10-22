// Página "Para empresas": envio público do formulário e acompanhamento no
// Admin (ADMIN-only no backend).
import api from "./api";
import type {
  NovaPropostaEmpresa,
  PropostaEmpresa,
  StatusPropostaEmpresa,
} from "@/lib/propostas-empresas";

export async function enviarPropostaEmpresa(dados: NovaPropostaEmpresa): Promise<void> {
  await api.post("/public/propostas-empresas", dados);
}

export async function listarPropostasEmpresas(): Promise<PropostaEmpresa[]> {
  const response = await api.get<PropostaEmpresa[]>("/admin/propostas-empresas");
  return response.data;
}

export async function atualizarStatusProposta(
  id: number,
  status: StatusPropostaEmpresa,
): Promise<PropostaEmpresa> {
  const response = await api.patch<PropostaEmpresa>(`/admin/propostas-empresas/${id}/status`, { status });
  return response.data;
}
