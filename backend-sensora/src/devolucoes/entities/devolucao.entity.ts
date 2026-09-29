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
