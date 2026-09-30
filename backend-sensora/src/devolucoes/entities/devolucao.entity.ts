import { StatusDevolucao } from '../enums/status-devolucao.enum';

export class ItemDevolucao {
  id: number;
  itemPedidoId: number;
  quantidade: number;
  precoUnitario: number;
}

// Foto da devolução. `url` é uma URL assinada de validade curta, gerada a
// cada resposta — nunca a URL pública nem o fileId/caminho do ImageKit.
export class EvidenciaDevolucao {
  id: number;
  url: string;
  criadoEm: Date;
}

export class Devolucao {
  id: number;
  pedidoId: number;
  status: StatusDevolucao;
  motivo: string;
  descricao: string | null;
  solicitadaEm: Date;
  // Preenchida quando a devolução é aprovada ou recusada. A observação da
  // análise (observacaoAnalise) não é exposta ao cliente.
  analisadaEm: Date | null;
  itens: ItemDevolucao[];
  evidencias: EvidenciaDevolucao[];
}

// Resposta de GET /pedidos/meus/:id/devolucoes: o histórico do pedido e o
// saldo que ainda pode ser devolvido de cada item (calculado no backend).
export class DevolucoesDoPedido {
  devolucoes: Devolucao[];
  itensDisponiveis: { itemPedidoId: number; quantidadeDisponivel: number }[];
}

// Etapa 7 — fila do Admin (GET /admin/devolucoes). Resumo leve: sem fotos
// (nenhuma URL assinada é gerada na fila) e sem dados internos.
export class DevolucaoResumoAdmin {
  id: number;
  pedidoId: number;
  pedidoNumero: string;
  clienteNome: string | null;
  clienteEmail: string | null;
  status: StatusDevolucao;
  solicitadaEm: Date;
  analisadaEm: Date | null;
  quantidadeItens: number; // soma das unidades pedidas
  quantidadeFotos: number;
}

// Etapa 7 — detalhe para análise do Admin (GET /admin/devolucoes/:id). As
// fotos vêm em URL assinada de validade curta, nunca fileId/caminho.
export class DevolucaoAnalise {
  id: number;
  status: StatusDevolucao;
  motivo: string;
  descricao: string | null;
  solicitadaEm: Date;
  analisadaEm: Date | null;
  observacaoAnalise: string | null;
  analisadoPorNome: string | null;
  pedido: {
    id: number;
    numero: string;
    data: Date;
    status: string;
    statusEnvio: string;
    enviadoEm: Date | null;
    total: number;
  };
  cliente: { nome: string | null; email: string | null };
  itens: {
    id: number;
    itemPedidoId: number;
    produtoNome: string;
    quantidade: number;
    quantidadeComprada: number;
    precoUnitario: number;
  }[];
  evidencias: EvidenciaDevolucao[];
}
