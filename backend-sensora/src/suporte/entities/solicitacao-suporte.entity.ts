import { CategoriaSuporte } from '../enums/categoria-suporte.enum';
import { StatusSolicitacaoSuporte } from '../enums/status-solicitacao-suporte.enum';

// Resposta ao cliente que acabou de abrir a solicitação.
export interface SolicitacaoSuporteCriada {
  id: number;
  categoria: CategoriaSuporte;
  assunto: string;
  status: StatusSolicitacaoSuporte;
  criadaEm: Date;
}

// Item de GET /suporte: os chamados do próprio cliente, para ele acompanhar
// a situação (sem mensagem, nome nem e-mail).
export interface SolicitacaoSuporteDoCliente extends SolicitacaoSuporteCriada {
  atualizadaEm: Date;
}

// Item de GET /admin/suporte (sem a mensagem, que fica no detalhe).
export interface SolicitacaoSuporteResumo {
  id: number;
  nome: string;
  email: string;
  categoria: CategoriaSuporte;
  assunto: string;
  status: StatusSolicitacaoSuporte;
  criadaEm: Date;
  atualizadaEm: Date;
}

// GET /admin/suporte/:id e resposta da troca de status.
export interface SolicitacaoSuporteDetalhe extends SolicitacaoSuporteResumo {
  usuarioId: number;
  mensagem: string;
}

export interface PaginaSolicitacoesSuporte {
  items: SolicitacaoSuporteResumo[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
