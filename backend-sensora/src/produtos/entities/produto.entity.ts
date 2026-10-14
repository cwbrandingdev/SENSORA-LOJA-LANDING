export class Produto {
  id: number;
  nome: string;
  slug: string;
  descricao?: string;
  aroma?: string;
  imagemUrl?: string;
  /** Galeria na ordem do Admin; a 1ª é a capa (= imagemUrl). */
  imagens: string[];
  ativo: boolean;
  categoriaId?: number;
  preco: number;
  quantidade: number;
  destaque: boolean;
}
