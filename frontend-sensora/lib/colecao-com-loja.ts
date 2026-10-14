import type { ProdutoPublico } from "@/lib/api-publica";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import {
  KIT_4_ESTACOES_SHOWCASE,
  getCategory,
  type Collection,
  type ProductItem,
} from "@/lib/content";
import { imagemKitRedimensionada } from "@/lib/loja-imagens";

// Junta a vitrine editorial da coleção (content.ts) com o catálogo do Admin:
// - produto cadastrado na categoria da coleção e ainda sem card editorial
//   entra no fim, com nome, aroma e foto do cadastro;
// - card editorial cujo produto saiu do catálogo (removido/inativo) some.
// Sem catálogo (API fora do ar devolve []), a vitrine fica como está.
// Hoje cada categoria tem uma coleção só; com duas, o produto novo
// apareceria nas duas.
export function colecaoComProdutosDaLoja(
  collection: Collection,
  produtos: ProdutoPublico[],
): Collection {
  if (produtos.length === 0) return collection;

  const categoriaLoja = getCategory(collection.categorySlug)?.lojaCategoriaSlug;
  const noCatalogo = new Set(produtos.map((produto) => produto.slug));
  const comCard = new Set([
    ...collection.items.map((item) => item.lojaSlug),
    KIT_4_ESTACOES_SHOWCASE.lojaSlug,
  ]);

  const editoriais = collection.items.filter(
    (item) => !item.lojaSlug || noCatalogo.has(item.lojaSlug),
  );
  const novos: ProductItem[] = produtos
    .filter(
      (produto) =>
        produto.categoria?.slug === categoriaLoja && !comCard.has(produto.slug),
    )
    .map((produto) => ({
      slug: produto.slug,
      name: produto.nome,
      description: produto.descricao ?? "",
      mood: produto.aroma,
      // Card de até ~270px: 600px cobre telas de alta densidade.
      imageSrc: imagemKitRedimensionada(produto.imagemUrl, 600),
      imageAlt: produto.nome,
      ctaLabel: "Conhecer",
      ctaHref: LOJA_PRODUTO_URL(produto.slug),
      lojaSlug: produto.slug,
    }));

  return { ...collection, items: [...editoriais, ...novos] };
}
