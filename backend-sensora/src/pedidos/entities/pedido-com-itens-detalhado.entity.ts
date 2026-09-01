import { Pedido } from './pedido.entity';

// Etapa 2 (Minha Conta / Meus Pedidos) — mesma forma de PedidoComItens, mas
// com o item enriquecido com nome/imagem do produto (ItemPedido "cru" só tem
// produtoId, insuficiente para a tela do cliente). Não reaproveita/altera
// ItemPedido nem PedidoComItens — nenhum consumidor existente (Admin) é
// afetado.
export class ItemPedidoDetalhado {
  id: number;
  pedidoId: number;
  produtoId: number;
  produtoNome: string;
  produtoImagemUrl?: string | null;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export class PedidoComItensDetalhado {
  pedido: Pedido;
  itens: ItemPedidoDetalhado[];
  total: number;
}
