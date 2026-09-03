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
  // Etapa 6.6 (aviso de estoque) — exposto para permitir que o frontend
  // limite o stepper de quantidade e mostre sinais discretos de
  // disponibilidade (Product Card, página do produto, carrinho). O backend
  // continua sendo a única autoridade real: esta contagem é só uma
  // ferramenta de UX, revalidada de verdade no checkout/pagamento (ver
  // ProdutosService.removerEstoque). Isso torna o número exato de unidades
  // em estoque uma informação pública da loja.
  quantidade: number;
}
