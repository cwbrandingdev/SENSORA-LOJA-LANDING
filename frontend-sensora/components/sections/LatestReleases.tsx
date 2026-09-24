import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { listarProdutosPublicos, type ProdutoPublico } from "@/lib/api-publica";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import { getCategory, getCategoryHref } from "@/lib/content";
import LatestReleasesGroups from "./LatestReleasesGroups";
import type { ReleaseItem } from "./LatestReleaseCard";

const MAX_PRODUTOS_POR_GRUPO = 12;

// Grupos da home, na ordem de exibição: Velas → Sprays → Difusores → Kits.
// `prefixo` casa com o slug real da categoria na API (ex.:
// "velas-aromaticas", "sprays-de-ambientes", "difusores-de-aroma", "kits"),
// tolerando variações de sufixo no backend. Produtos sem categoria
// reconhecida não aparecem na seção. Kits não é uma CategorySlug do site:
// o "Ver todos" segue o mesmo destino do item "Kits" da navbar.
const GRUPOS = [
  { id: "velas", prefixo: "vela", label: getCategory("velas")?.label ?? "Velas", href: getCategoryHref("velas") },
  { id: "sprays", prefixo: "spray", label: getCategory("sprays")?.label ?? "Sprays", href: getCategoryHref("sprays") },
  { id: "difusores", prefixo: "difus", label: getCategory("difusores")?.label ?? "Difusores", href: getCategoryHref("difusores") },
  { id: "kits", prefixo: "kit", label: "Kits", href: "/colecoes" },
];

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

  const grupos = GRUPOS.map(({ prefixo, ...grupo }) => ({
    ...grupo,
    produtos: produtosApi
      .filter((produto) => produto.categoria?.slug.startsWith(prefixo))
      .map(fromApi)
      .slice(0, MAX_PRODUTOS_POR_GRUPO),
  })).filter((grupo) => grupo.produtos.length > 0);

  if (grupos.length === 0) {
    return null;
  }

  return (
    // Padding enxuto dos dois lados: somado ao pb de ProductCategories
    // (acima) e ao pt de AboutSection (abaixo), todas com o mesmo fundo,
    // mantém ~120/176/208px de vão entre as seções (mobile/sm/lg).
    <section
      aria-labelledby="lancamentos-heading"
      className="relative bg-[#f5f2ed] pt-15 pb-15 sm:pt-22 sm:pb-22 lg:pt-26 lg:pb-26"
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

        <LatestReleasesGroups grupos={grupos} />
      </div>
    </section>
  );
}
