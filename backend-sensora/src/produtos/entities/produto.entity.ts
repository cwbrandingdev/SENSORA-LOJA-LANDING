export class Produto {
  id: number;
  nome: string;
  slug: string;
  descricao?: string;
  aroma?: string;
  imagemUrl?: string;
  ativo: boolean;
  categoriaId?: number;
  preco: number;
  quantidade: number;
  destaque: boolean;
}
