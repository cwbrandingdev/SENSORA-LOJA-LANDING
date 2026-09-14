import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { listarProdutosPublicos, type ProdutoPublico } from "@/lib/api-publica";
import { LOJA_PRODUTO_URL } from "@/lib/config";
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
    lancamento: produto.destaque,
    produto,
  };
}

export default async function LatestReleases() {
  const produtosApi = await listarProdutosPublicos();
  const lancamentos = produtosApi.map(fromApi).slice(0, MAX_PRODUTOS);

  if (lancamentos.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="lancamentos-heading"
      className="relative bg-[#f5f2ed] py-24 sm:py-32 lg:py-40"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <RevealOnScroll className="mb-8 text-center sm:mb-10">
          <h2
            id="lancamentos-heading"
            className="font-serif text-[1.65rem] font-normal tracking-tight text-brand-navy sm:text-3xl lg:text-[2.15rem]"
          >
            Conheça os últimos lançamentos.
          </h2>
        </RevealOnScroll>

        <LatestReleasesCarousel produtos={lancamentos} />
      </div>
    </section>
  );
}
