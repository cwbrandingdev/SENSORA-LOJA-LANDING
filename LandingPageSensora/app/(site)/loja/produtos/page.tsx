import type { Metadata } from "next";
import Link from "next/link";
import {
  ApiPublicaIndisponivelError,
  listarCategoriasPublicasOuFalha,
  listarProdutosPublicosOuFalha,
} from "@/lib/api-publica";
import { ROUTES } from "@/lib/routes";
import CategoryFilter from "@/components/loja/CategoryFilter";
import ProductGrid from "@/components/loja/ProductGrid";
import RevealOnScroll from "@/components/ui/RevealOnScroll";

export const metadata: Metadata = {
  title: "Catálogo",
};

type CatalogoPageProps = {
  searchParams: Promise<{ categoria?: string }>;
};

export default async function CatalogoPage({ searchParams }: CatalogoPageProps) {
  const { categoria: categoriaAtiva } = await searchParams;

  let categorias;
  let produtos;
  try {
    [categorias, produtos] = await Promise.all([
      listarCategoriasPublicasOuFalha(),
      listarProdutosPublicosOuFalha(),
    ]);
  } catch (err) {
    if (err instanceof ApiPublicaIndisponivelError) {
      return (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-32 text-center sm:py-40">
          <span className="h-px w-12 bg-brand-orange" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Erro
          </p>
          <h1 className="font-serif text-2xl font-normal text-brand-navy sm:text-3xl">
            Não foi possível carregar o catálogo agora
          </h1>
          <p className="text-base leading-relaxed text-slate-600">
            Tente novamente em instantes.
          </p>
          <Link
            href={ROUTES.LOJA_PRODUTOS}
            className="mt-2 text-[13px] uppercase tracking-[0.14em] text-brand-navy underline underline-offset-4"
          >
            Tentar novamente
          </Link>
        </div>
      );
    }
    throw err;
  }

  const produtosFiltrados = categoriaAtiva
    ? produtos.filter((produto) => produto.categoria?.slug === categoriaAtiva)
    : produtos;

  return (
    <div className="mx-auto max-w-7xl px-6 pt-28 pb-24 sm:pt-36 sm:pb-32 lg:px-10 lg:pb-40">
      <RevealOnScroll>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Produtos
        </p>
        <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy">
          Catálogo
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600">
          Velas, difusores e sprays de ambiente.
        </p>
      </RevealOnScroll>

      <div className="mt-10 border-b border-slate-200 pb-8">
        <CategoryFilter categorias={categorias} categoriaAtiva={categoriaAtiva} />
      </div>

      <div className="mt-12">
        <ProductGrid produtos={produtosFiltrados} actionLabel="Ver detalhes" />
      </div>
    </div>
  );
}
