import { StatusAvaliacao } from '../enums/status-avaliacao.enum';

// A avaliação que o próprio cliente fez de um produto do pedido.
export interface AvaliacaoDoCliente {
  produtoId: number;
  nota: number;
  comentario: string | null;
  status: StatusAvaliacao;
  atualizadaEm: Date;
}

// GET /avaliacoes/pedido/:id — as avaliações do cliente e a partir de
// quando ele pode avaliar (null: pedido ainda não pago/enviado).
export interface AvaliacoesDoPedido {
  liberadaEm: Date | null;
  avaliacoes: AvaliacaoDoCliente[];
}

// Avaliação aprovada, como aparece na página do produto.
export interface AvaliacaoPublica {
  id: number;
  nomeExibicao: string;
  nota: number;
  comentario: string | null;
  criadaEm: Date;
}

// GET /public/produtos/:slug/avaliacoes — média só das aprovadas.
export interface ResumoAvaliacoes {
  media: number | null;
  total: number;
  avaliacoes: AvaliacaoPublica[];
}

// Item da fila do Admin.
export interface AvaliacaoAdmin {
  id: number;
  produtoId: number;
  produtoNome: string;
  produtoSlug: string;
  pedidoId: number;
  pedidoNumero: string;
  nomeExibicao: string;
  clienteEmail: string | null;
  nota: number;
  comentario: string | null;
  status: StatusAvaliacao;
  criadaEm: Date;
  atualizadaEm: Date;
}
