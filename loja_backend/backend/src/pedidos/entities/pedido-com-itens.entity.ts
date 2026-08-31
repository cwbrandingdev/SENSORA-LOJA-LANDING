import { ItemPedido } from '../../itens-pedido/entities/item-pedido.entity';
import { Pedido } from './pedido.entity';

export class PedidoComItens {
  pedido: Pedido;
  itens: ItemPedido[];
  total: number;
}
