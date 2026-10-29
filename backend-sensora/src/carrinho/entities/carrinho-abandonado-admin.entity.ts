// Sacola autenticada parada (já no prazo do lembrete, ou lembrete já
// enviado). Usado pelo painel "Para acompanhar" — quem tem Pedido
// PENDENTE fica de fora daqui e entra pela lista de checkout.
export class ItemCarrinhoAdmin {
  produtoId: number;
  nome: string;
  quantidade: number;
  preco: number;
}

export class CarrinhoAbandonadoAdmin {
  usuarioId: number;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone: string | null;
  itens: ItemCarrinhoAdmin[];
  total: number;
  paradoEm: Date;
  lembreteEnviadoEm: Date | null;
}
