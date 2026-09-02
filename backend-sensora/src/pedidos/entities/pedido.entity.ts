import { StatusPedido } from '../enums/status-pedido.enum';

export class Pedido {
  id: number;
  numero: string;
  data: Date;
  status: StatusPedido;
  total: number;

  // Etapa 6.5 (Frete) — snapshot do endereço de entrega e do frete
  // escolhido/validado nesta compra (ver CheckoutService.createSession).
  // Opcionais: pedidos criados antes desta etapa não têm esses dados.
  enderecoCep?: string;
  enderecoRua?: string;
  enderecoNumero?: string;
  enderecoComplemento?: string;
  enderecoBairro?: string;
  enderecoCidade?: string;
  enderecoEstado?: string;
  freteValor?: number;
  freteTransportadora?: string;
  freteServico?: string;
  fretePrazoDias?: number;
}
