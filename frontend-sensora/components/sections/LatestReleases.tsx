import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { listarProdutosPublicos, type ProdutoPublico } from "@/lib/api-publica";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import { descricaoSemFichaTecnica } from "@/lib/descricao-produto";
import {
  DIFUSORES_DE_AROMA,
  SPRAYS_DE_AMBIENTE,
  getCategory,
  getCategoryHref,
  type Collection,
} from "@/lib/content";
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

// Cards editoriais que completam a fileira enquanto o produto ainda não
// está no catálogo da Loja (hoje: "Brisa de Inverno", 4º card de Sprays e
// de Difusores). Entram só se nenhum produto real tiver o mesmo nome —
// quando o produto for cadastrado no Admin, o card real o substitui.
const COLECOES_EDITORIAIS: Record<string, Collection> = {
  sprays: SPRAYS_DE_AMBIENTE,
  difusores: DIFUSORES_DE_AROMA,
};

function extrasEditoriais(
  grupoId: string,
  produtos: ReleaseItem[],
  href: string,
): ReleaseItem[] {
  const colecao = COLECOES_EDITORIAIS[grupoId];
  if (!colecao) return [];
  const nomesNoCatalogo = new Set(
    produtos.map((produto) => produto.nome.trim().toLowerCase()),
  );
  const precoDaLinha = produtos[0]?.preco;
  return colecao.items
    .filter((item) => !nomesNoCatalogo.has(item.name.trim().toLowerCase()))
    .map((item) => ({
      key: `editorial-${colecao.slug}-${item.slug}`,
      nome: item.name,
      href,
      imagemUrl: item.imageSrc,
      preco: precoDaLinha,
      acaoLabel: "Conhecer",
    }));
}

function fromApi(produto: ProdutoPublico): ReleaseItem {
  return {
    key: `api-${produto.id}`,
    nome: produto.nome,
    href: LOJA_PRODUTO_URL(produto.slug),
    imagemUrl: produto.imagemUrl,
    preco: produto.preco,
    lancamento: produto.destaque,
    // Sem a ficha técnica (volume, queima, borrifadas…) nas descrições que
    // os cards exibem — ver lib/descricao-produto.ts.
    produto: produto.descricao
      ? { ...produto, descricao: descricaoSemFichaTecnica(produto.descricao) }
      : produto,
  };
}

export default async function LatestReleases() {
  const produtosApi = await listarProdutosPublicos();

  const grupos = GRUPOS.map(({ prefixo, ...grupo }) => {
    const doCatalogo = produtosApi
      .filter((produto) => produto.categoria?.slug.startsWith(prefixo))
      .map(fromApi);
    return {
      ...grupo,
      produtos: [...doCatalogo, ...extrasEditoriais(grupo.id, doCatalogo, grupo.href)].slice(
        0,
        MAX_PRODUTOS_POR_GRUPO,
      ),
    };
  }).filter((grupo) => grupo.produtos.length > 0);

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
