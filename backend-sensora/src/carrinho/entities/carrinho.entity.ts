export class ItemCarrinho {
  produtoId: number;
  quantidade: number;
  nome: string;
  slug: string;
  preco: number;
  imagemUrl?: string;
  estoqueConhecido: number;
}

export class Carrinho {
  itens: ItemCarrinho[];
}
