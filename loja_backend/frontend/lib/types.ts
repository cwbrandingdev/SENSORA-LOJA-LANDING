export interface Produto {
  id: number;
  nome: string;
  descricao?: string | null;
  preco: number;
  quantidade: number;
}

export interface Categoria {
  id: number;
  nome: string;
  descricao?: string | null;
}

export interface Cliente {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  endereco: string;
}

export type PedidoStatus = "PENDENTE" | "PAGO" | "CANCELADO";

export interface Pedido {
  id: number;
  numero: string;
  data: string;
  status: PedidoStatus;
  total: number;
}

export interface ItemPedido {
  id: number;
  pedidoId: number;
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

export interface PedidoComItens {
  pedido: Pedido;
  itens: ItemPedido[];
  total: number;
}

export type Perfil = "ADMIN" | "VENDEDOR" | "CLIENTE";

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
}
