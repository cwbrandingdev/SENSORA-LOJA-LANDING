import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buscarProdutoPublicoPorSlug, ApiPublicaIndisponivelError } from "@/lib/api-publica";
import { ROUTES } from "@/lib/routes";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import ImageReveal from "@/components/ui/ImageReveal";
import AddToCartControls from "@/components/loja/AddToCartControls";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ProdutoPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProdutoPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const produto = await buscarProdutoPublicoPorSlug(slug);
    if (!produto) {
      return { title: "Produto não encontrado" };
    }
    return { title: produto.nome };
  } catch {
    return { title: "Catálogo" };
  }
}

export default async function ProdutoPage({ params }: ProdutoPageProps) {
  const { slug } = await params;

  let produto;
  try {
    produto = await buscarProdutoPublicoPorSlug(slug);
  } catch (err) {
    if (err instanceof ApiPublicaIndisponivelError) {
      return (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-32 text-center sm:py-40">
          <span className="h-px w-12 bg-brand-orange" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Erro
          </p>
          <h1 className="font-serif text-2xl font-normal text-brand-navy sm:text-3xl">
            Não foi possível carregar este produto
          </h1>
          <p className="text-base leading-relaxed text-slate-600">
            Tente novamente em instantes.
          </p>
          <Link
            href={ROUTES.LOJA_PRODUTOS}
            className="mt-2 text-[13px] uppercase tracking-[0.14em] text-brand-navy underline underline-offset-4"
          >
            Voltar ao catálogo
          </Link>
        </div>
      );
    }
    throw err;
  }

  if (!produto) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-6 pt-28 pb-12 sm:pt-36 lg:px-10 lg:pb-20">
      <Link
        href={
          produto.categoria?.slug
            ? `${ROUTES.LOJA_PRODUTOS}?categoria=${encodeURIComponent(produto.categoria.slug)}`
            : ROUTES.LOJA_PRODUTOS
        }
        className="text-[13px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-brand-navy"
      >
        ← Catálogo
      </Link>

      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-brand-navy lg:aspect-[3/4]">
          {produto.destaque && (
            <span className="absolute left-4 top-4 z-10 bg-background/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-brand-orange">
              Destaque
            </span>
          )}
          <ImageReveal>
            <PlaceholderImage
              src={produto.imagemUrl}
              alt={produto.nome}
              label={produto.nome}
              priority
              unoptimized={Boolean(produto.imagemUrl)}
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </ImageReveal>
        </div>

        <RevealOnScroll delayMs={80} className="flex flex-col justify-center">
          {produto.categoria?.nome && (
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
              {produto.categoria.nome}
            </p>
          )}

          <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight leading-tight text-brand-navy sm:text-5xl">
            {produto.nome}
          </h1>

          {produto.aroma && (
            <p className="mt-3 text-[15px] italic text-slate-600">{produto.aroma}</p>
          )}

          <p className="mt-8 text-3xl font-semibold tracking-tight tabular-nums text-brand-navy">
            {formatPrice.format(produto.preco)}
          </p>

          {produto.descricao && (
            <p className="mt-8 max-w-md text-[15px] leading-relaxed text-slate-600">
              {produto.descricao}
            </p>
          )}

          <div className="mt-10">
            <AddToCartControls
              produto={{
                produtoId: produto.id,
                nome: produto.nome,
                slug: produto.slug,
                imagemUrl: produto.imagemUrl,
                preco: produto.preco,
              }}
            />
          </div>

          <div className="mt-8">
            <Link
              href={
                produto.categoria?.slug
                  ? `/loja/produtos?categoria=${encodeURIComponent(produto.categoria.slug)}`
                  : "/loja/produtos"
              }
              className="text-[13px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-brand-navy"
            >
              {produto.categoria?.nome
                ? `Ver mais em ${produto.categoria.nome} →`
                : "Ver catálogo completo →"}
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
