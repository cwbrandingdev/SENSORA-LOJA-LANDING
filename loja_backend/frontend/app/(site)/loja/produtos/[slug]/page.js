import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarProdutoPublicoPorSlug } from "@/lib/api-publica";
import { ProductImage } from "@/components/loja/ProductImage";
import { ProductPrice } from "@/components/loja/ProductPrice";
import { Reveal } from "@/components/site/Reveal";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const produto = await buscarProdutoPublicoPorSlug(slug);

  if (!produto) {
    return { title: "Produto não encontrado" };
  }

  return { title: produto.nome };
}

export default async function ProdutoPage({ params }) {
  const { slug } = await params;
  const produto = await buscarProdutoPublicoPorSlug(slug);

  if (!produto) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-20">
      <Link
        href={
          produto.categoria?.slug
            ? `/loja/produtos?categoria=${produto.categoria.slug}`
            : "/loja/produtos"
        }
        className="font-inter text-[13px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-brand-navy"
      >
        ← Catálogo
      </Link>

      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <Reveal className="relative aspect-[4/5] overflow-hidden bg-sensora-bg-soft lg:aspect-[3/4]">
          <ProductImage src={produto.imagemUrl} alt={produto.nome} priority />
        </Reveal>

        <Reveal index={1} className="flex flex-col justify-center">
          {produto.categoria?.nome ? (
            <p className="font-inter text-[13px] uppercase tracking-[0.14em] text-slate-500">
              {produto.categoria.nome}
            </p>
          ) : null}

          <h1 className="mt-3 font-fraunces text-4xl font-light leading-tight text-brand-navy sm:text-5xl">
            {produto.nome}
          </h1>

          {produto.aroma ? (
            <p className="mt-3 font-inter text-[15px] italic text-brand-navy/70">
              {produto.aroma}
            </p>
          ) : null}

          <ProductPrice
            value={produto.preco}
            className="mt-8 font-inter text-2xl text-brand-navy"
          />

          {produto.descricao ? (
            <p className="mt-8 max-w-md font-inter text-[15px] leading-relaxed text-brand-navy/70">
              {produto.descricao}
            </p>
          ) : null}

          <Link
            href={
              produto.categoria?.slug
                ? `/loja/produtos?categoria=${produto.categoria.slug}`
                : "/loja/produtos"
            }
            className="mt-10 inline-block w-fit border-b border-brand-orange/70 pb-1 font-inter text-[13px] uppercase tracking-[0.16em] text-brand-navy transition-colors hover:border-brand-orange hover:text-brand-orange"
          >
            {produto.categoria?.nome
              ? `Ver mais em ${produto.categoria.nome}`
              : "Ver catálogo completo"}
          </Link>
        </Reveal>
      </div>
    </div>
  );
}
