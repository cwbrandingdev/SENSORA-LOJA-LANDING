export class CategoriaResumo {
  id: number;
  nome: string;
  slug: string;
}

export class ProdutoPublico {
  id: number;
  nome: string;
  slug: string;
  descricao?: string;
  preco: number;
  imagemUrl?: string;
  aroma?: string;
  destaque: boolean;
  categoriaId?: number;
  categoria?: CategoriaResumo;
}
