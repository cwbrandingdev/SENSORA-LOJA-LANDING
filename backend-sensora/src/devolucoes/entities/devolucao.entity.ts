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
  itens: ItemDevolucao[];
  evidencias: EvidenciaDevolucao[];
}
