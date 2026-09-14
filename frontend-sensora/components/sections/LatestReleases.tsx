import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { listarProdutosPublicos, type ProdutoPublico } from "@/lib/api-publica";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import {
  CATEGORIES,
  COLLECTIONS,
  getItemHref,
} from "@/lib/content";
import LatestReleasesCarousel from "./LatestReleasesCarousel";
import type { ReleaseItem } from "./LatestReleaseCard";

const MAX_PRODUTOS = 12;

function fromApi(produto: ProdutoPublico): ReleaseItem {
  return {
    key: `api-${produto.id}`,
    nome: produto.nome,
    href: LOJA_PRODUTO_URL(produto.slug),
    imagemUrl: produto.imagemUrl,
    preco: produto.preco,
    categoria: produto.categoria?.nome,
    lancamento: produto.destaque,
    produto,
  };
}

function fromCollections(produtosApi: ProdutoPublico[]): ReleaseItem[] {
  return COLLECTIONS.flatMap((collection) => {
    const categoria = CATEGORIES.find(
      (category) => category.slug === collection.categorySlug,
    )?.label;

    return collection.items.map((item) => {
      const produto = produtosApi.find(
        (candidato) =>
          candidato.slug === item.slug ||
          candidato.nome.localeCompare(item.name, "pt-BR", {
            sensitivity: "accent",
          }) === 0,
      );

      return {
        key: `${collection.slug}-${item.slug}`,
        nome: item.name,
        href: produto ? LOJA_PRODUTO_URL(produto.slug) : getItemHref(collection, item),
        imagemUrl: item.imageSrc,
        preco: produto?.preco,
        categoria,
        selo: item.seasonLabel,
        lancamento: collection.slug === "4-estacoes",
        produto,
      };
    });
  });
}

export default async function LatestReleases() {
  const produtosApi = await listarProdutosPublicos();
  const daColecao = fromCollections(produtosApi);
  const lancamentos = (
    daColecao.length > 0 ? daColecao : produtosApi.map(fromApi)
  ).slice(0, MAX_PRODUTOS);

  if (lancamentos.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="lancamentos-heading"
      className="relative bg-white px-3 py-16 sm:px-5 sm:py-20 lg:px-8"
    >
      <RevealOnScroll className="mb-8 text-center sm:mb-10">
        <h2
          id="lancamentos-heading"
          className="font-serif text-[1.65rem] font-normal tracking-tight text-[#6a6158] sm:text-3xl lg:text-[2.15rem]"
        >
          Conheça os últimos lançamentos.
        </h2>
      </RevealOnScroll>

      <LatestReleasesCarousel produtos={lancamentos} />
    </section>
  );
}
