// GET /admin/checkout/pendentes — sacola parada (e-mail de carrinho) e
// Pedido PENDENTE (e-mail de checkout), para a equipe falar com o cliente.
export type TipoAcompanhamentoAdmin = 'CARRINHO' | 'CHECKOUT';

export class ItemAcompanhamentoAdmin {
  produtoId: number;
  nome: string;
  quantidade: number;
  preco: number;
}

export class CheckoutPendenteAdmin {
  id: string;
  tipo: TipoAcompanhamentoAdmin;
  clienteNome: string | null;
  clienteEmail: string | null;
  clienteTelefone: string | null;
  usuarioId: number | null;
  itens: ItemAcompanhamentoAdmin[];
  total: number;
  paradoEm: Date;
  minutosParado: number;
  lembreteEnviadoEm: Date | null;
  pedidoId: number | null;
  numero: string | null;
  minutosRestantes: number | null;
}
