import {
  listarCategoriasPublicas,
  listarProdutosPublicos,
} from "@/lib/api-publica";
import { CategoryFilter } from "@/components/loja/CategoryFilter";
import { ProductGrid } from "@/components/loja/ProductGrid";
import { Reveal } from "@/components/site/Reveal";

export const metadata = {
  title: "Catálogo",
};

export default async function CatalogoPage({ searchParams }) {
  const { categoria: categoriaAtiva } = await searchParams;

  const [categorias, produtos] = await Promise.all([
    listarCategoriasPublicas(),
    listarProdutosPublicos(),
  ]);

  const produtosFiltrados = categoriaAtiva
    ? produtos.filter((produto) => produto.categoria?.slug === categoriaAtiva)
    : produtos;

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
      <Reveal>
        <h1 className="font-fraunces text-4xl font-light italic text-brand-navy">
          Catálogo
        </h1>
      </Reveal>
      <Reveal index={1}>
        <p className="mt-4 max-w-md font-inter text-[15px] text-brand-navy/70">
          Velas, difusores e sprays de ambiente.
        </p>
      </Reveal>

      <div className="mt-10 border-b border-slate-200 pb-8">
        <CategoryFilter categorias={categorias} categoriaAtiva={categoriaAtiva} />
      </div>

      <div className="mt-12">
        <ProductGrid produtos={produtosFiltrados} />
      </div>
    </div>
  );
}
