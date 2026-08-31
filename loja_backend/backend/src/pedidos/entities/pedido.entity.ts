import { StatusPedido } from '../enums/status-pedido.enum';

export class Pedido {
  id: number;
  numero: string;
  data: Date;
  status: StatusPedido;
  total: number;
}
