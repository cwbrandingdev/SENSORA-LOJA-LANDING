// Suporte ao cliente. POST /suporte é do próprio cliente autenticado: o
// backend tira usuário, nome e e-mail do token e do cadastro — daqui só
// saem assunto e mensagem. As rotas /admin/suporte são só ADMIN.
import api from "./api";
import type {
  CriarSolicitacaoSuportePayload,
  PaginaSolicitacoesSuporte,
  SolicitacaoSuporteCriada,
  SolicitacaoSuporteDetalhe,
  StatusSolicitacaoSuporte,
} from "@/lib/types/loja";

export async function criarSolicitacaoSuporte(
  data: CriarSolicitacaoSuportePayload,
): Promise<SolicitacaoSuporteCriada> {
  const response = await api.post<SolicitacaoSuporteCriada>("/suporte", data);
  return response.data;
}

export async function listarSolicitacoesSuporte(filtros: {
  page?: number;
  status?: string;
}): Promise<PaginaSolicitacoesSuporte> {
  const response = await api.get<PaginaSolicitacoesSuporte>("/admin/suporte", {
    params: {
      page: filtros.page ?? 1,
      ...(filtros.status ? { status: filtros.status } : {}),
    },
  });
  return response.data;
}

export async function buscarSolicitacaoSuporte(id: number): Promise<SolicitacaoSuporteDetalhe> {
  const response = await api.get<SolicitacaoSuporteDetalhe>(`/admin/suporte/${id}`);
  return response.data;
}

export async function atualizarStatusSuporte(
  id: number,
  status: Exclude<StatusSolicitacaoSuporte, "ABERTA">,
): Promise<SolicitacaoSuporteDetalhe> {
  const response = await api.patch<SolicitacaoSuporteDetalhe>(`/admin/suporte/${id}/status`, {
    status,
  });
  return response.data;
}
