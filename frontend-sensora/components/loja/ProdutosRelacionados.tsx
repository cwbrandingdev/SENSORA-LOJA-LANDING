import ProductCard from "@/components/sections/ProductCard";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { listarProdutosPublicos, type ProdutoPublico } from "@/lib/api-publica";
import { normalizarBusca } from "@/lib/busca-produtos";

const MAX_SUGESTOES = 4;

// "Você também pode gostar", abaixo da página do produto. Intercala as
// categorias para variar: 1 da mesma categoria do produto aberto, depois 1
// de cada outra, e repete, sem repetir o nome (ex.: "Baunilha" vela e
// spray). Dentro de cada categoria, em estoque antes de esgotado e
// destaques primeiro; o ponto de partida gira com o produto aberto, para
// cada página sugerir coisas diferentes. Produto sem categoria (ex.:
// cadastro de teste) fica de fora. Sem sugestões (ou API fora do ar), a
// seção não aparece.
function nota(produto: ProdutoPublico) {
  return (produto.quantidade > 0 ? 2 : 0) + (produto.destaque ? 1 : 0);
}

function intercalarCategorias(produtos: ProdutoPublico[], atual: ProdutoPublico) {
  const porCategoria = new Map<number | undefined, ProdutoPublico[]>();
  for (const produto of [...produtos].sort((a, b) => nota(b) - nota(a))) {
    porCategoria.set(produto.categoriaId, [...(porCategoria.get(produto.categoriaId) ?? []), produto]);
  }
  // A fila da mesma categoria vai na frente; as outras, na ordem do catálogo.
  const filas = [...porCategoria.entries()]
    .sort(([a], [b]) => Number(b === atual.categoriaId) - Number(a === atual.categoriaId))
    .map(([, fila]) => {
      const disponiveis = fila.filter((produto) => produto.quantidade > 0);
      const giro = disponiveis.length > 0 ? atual.id % disponiveis.length : 0;
      return [...disponiveis.slice(giro), ...disponiveis.slice(0, giro), ...fila.slice(disponiveis.length)];
    });

  const nomes = new Set([normalizarBusca(atual.nome)]);
  const sugestoes: ProdutoPublico[] = [];
  while (sugestoes.length < MAX_SUGESTOES && filas.some((fila) => fila.length > 0)) {
    for (const fila of filas) {
      if (sugestoes.length === MAX_SUGESTOES || fila.length === 0) continue;
      // Primeiro de nome ainda não sugerido; se todos repetem, o primeiro mesmo.
      const indice = Math.max(0, fila.findIndex((produto) => !nomes.has(normalizarBusca(produto.nome))));
      const [proximo] = fila.splice(indice, 1);
      nomes.add(normalizarBusca(proximo.nome));
      sugestoes.push(proximo);
    }
  }
  return sugestoes;
}

export default async function ProdutosRelacionados({ atual }: { atual: ProdutoPublico }) {
  const produtos = await listarProdutosPublicos();
  const sugestoes = intercalarCategorias(
    produtos.filter((produto) => produto.id !== atual.id && produto.categoria),
    atual,
  );

  if (sugestoes.length === 0) return null;

  return (
    <section aria-labelledby="relacionados-heading" className="mt-12 border-t border-slate-200 pt-10 sm:mt-16 sm:pt-12">
      <RevealOnScroll className="mb-8 text-center sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">Sugestões</p>
        <h2 id="relacionados-heading" className="mt-4 font-serif text-3xl font-normal text-brand-navy sm:text-4xl">
          Você também pode gostar
        </h2>
      </RevealOnScroll>

      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-10 sm:gap-y-14">
        {sugestoes.map((produto, index) => (
          <ProductCard key={produto.id} produto={produto} delayMs={index * 90} />
        ))}
      </div>
    </section>
  );
}
