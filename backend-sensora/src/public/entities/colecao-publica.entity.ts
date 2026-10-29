import { ProdutoPublico } from './produto-publico.entity';

// Item do menu da loja: só coleções ativas.
export class ColecaoPublica {
  id: number;
  nome: string;
  slug: string;
  descricao?: string;
  imagemUrl?: string;
}

// Página da coleção: inclui os produtos ativos dela.
export class ColecaoPublicaComProdutos extends ColecaoPublica {
  produtos: ProdutoPublico[];
}
