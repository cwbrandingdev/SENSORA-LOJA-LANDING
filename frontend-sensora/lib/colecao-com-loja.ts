import type { ProdutoPublico } from "@/lib/api-publica";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import {
  KIT_4_ESTACOES_SHOWCASE,
  getCategory,
  type Collection,
  type ProductItem,
} from "@/lib/content";
import {
  imagemKitRedimensionada,
  segundaImagemDaGaleria,
} from "@/lib/loja-imagens";

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

  const porSlug = new Map(produtos.map((produto) => [produto.slug, produto]));
  const editoriais = collection.items
    .filter((item) => !item.lojaSlug || noCatalogo.has(item.lojaSlug))
    .map((item) => {
      // Cartão editorial de um produto real usa a capa escolhida no Admin,
      // a 2ª foto da galeria para o hover (ver HoverSecondImage) e o preço
      // do catálogo.
      const produtoReal = item.lojaSlug ? porSlug.get(item.lojaSlug) : undefined;
      const segunda = produtoReal
        ? segundaImagemDaGaleria(produtoReal.imagens, produtoReal.imagemUrl)
        : undefined;
      return {
        ...item,
        ...(produtoReal?.imagemUrl
          ? { imageSrc: imagemKitRedimensionada(produtoReal.imagemUrl, 600) }
          : {}),
        ...(segunda
          ? { imageHoverSrc: imagemKitRedimensionada(segunda, 600) }
          : {}),
        ...(produtoReal ? { preco: produtoReal.preco } : {}),
      };
    });
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
      imageHoverSrc: imagemKitRedimensionada(
        segundaImagemDaGaleria(produto.imagens, produto.imagemUrl),
        600,
      ),
      imageAlt: produto.nome,
      preco: produto.preco,
      ctaLabel: "Conhecer",
      ctaHref: LOJA_PRODUTO_URL(produto.slug),
      lojaSlug: produto.slug,
    }));

  // Item editorial ainda sem cadastro na Loja (ex.: "Brisa de Inverno")
  // herda o preço da linha para a vitrine não ficar com um cartão sem preço
  // no meio dos outros — quando o produto for cadastrado, o preço real o
  // substitui (mesma regra do card editorial da home).
  const precoDaLinha = produtos.find(
    (produto) => produto.categoria?.slug === categoriaLoja,
  )?.preco;
  const items = [...editoriais, ...novos].map((item) =>
    item.preco == null && precoDaLinha != null
      ? { ...item, preco: precoDaLinha }
      : item,
  );

  return { ...collection, items };
}
