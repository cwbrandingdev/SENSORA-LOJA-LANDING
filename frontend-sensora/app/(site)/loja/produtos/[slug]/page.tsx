import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buscarProdutoPublicoPorSlug,
  ApiPublicaIndisponivelError,
} from "@/lib/api-publica";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import { ROUTES } from "@/lib/routes";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import AddToCartControls from "@/components/loja/AddToCartControls";
import AvisosProduto from "@/components/loja/AvisosProduto";
import GaleriaProduto from "@/components/loja/GaleriaProduto";
import ProdutosRelacionados from "@/components/loja/ProdutosRelacionados";
import { imagemKitRedimensionada } from "@/lib/loja-imagens";
import JsonLd from "@/components/seo/JsonLd";
import { OPEN_GRAPH_PADRAO, breadcrumbJsonLd, resumir, urlAbsoluta } from "@/lib/seo";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ProdutoPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProdutoPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const produto = await buscarProdutoPublicoPorSlug(slug);
    if (!produto) {
      return { title: "Produto não encontrado" };
    }
    const description = resumir(
      produto.descricao || `${produto.nome}${produto.aroma ? ` — ${produto.aroma}` : ""}, da Sensora.`,
    );
    return {
      title: produto.nome,
      description,
      alternates: { canonical: LOJA_PRODUTO_URL(produto.slug) },
      openGraph: {
        ...OPEN_GRAPH_PADRAO,
        title: produto.nome,
        description,
        url: LOJA_PRODUTO_URL(produto.slug),
        ...(produto.imagemUrl && {
          images: [{ url: imagemKitRedimensionada(produto.imagemUrl, 1200), alt: produto.nome }],
        }),
      },
    };
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

  // Produto de antes da galeria (ou backend ainda sem `imagens`): só a capa.
  const imagens = produto.imagens?.length
    ? produto.imagens
    : produto.imagemUrl
      ? [produto.imagemUrl]
      : [];

  // Preço, fotos e disponibilidade nos resultados do Google e para as IAs.
  const produtoJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: produto.nome,
    sku: String(produto.id),
    ...(produto.descricao && { description: produto.descricao }),
    ...(imagens.length > 0 && { image: imagens.map((url) => urlAbsoluta(url)) }),
    ...(produto.categoria?.nome && { category: produto.categoria.nome }),
    brand: { "@type": "Brand", name: "Sensora" },
    offers: {
      "@type": "Offer",
      url: urlAbsoluta(LOJA_PRODUTO_URL(produto.slug)),
      price: produto.preco.toFixed(2),
      priceCurrency: "BRL",
      itemCondition: "https://schema.org/NewCondition",
      availability:
        produto.quantidade > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-6 pt-4 pb-12 sm:pt-0 lg:px-10 lg:pb-20">
      <JsonLd data={produtoJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Início", caminho: "/" },
          { nome: "Catálogo", caminho: ROUTES.LOJA_PRODUTOS },
          { nome: produto.nome, caminho: LOJA_PRODUTO_URL(produto.slug) },
        ])}
      />
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
        <GaleriaProduto imagens={imagens} nome={produto.nome} destaque={produto.destaque} />

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
            <p className="mt-3 text-[15px] italic text-slate-600">
              {produto.aroma}
            </p>
          )}

          <p className="mt-8 text-3xl font-semibold tracking-tight tabular-nums text-brand-navy">
            {formatPrice.format(produto.preco)}
          </p>

          {produto.descricao && (
            <p className="mt-8 max-w-xl whitespace-pre-line text-[15px] leading-relaxed text-slate-600">
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
                estoqueConhecido: produto.quantidade,
              }}
            />
          </div>

          <AvisosProduto
            categoriaSlug={produto.categoria?.slug}
            categoriaNome={produto.categoria?.nome}
            quantidade={produto.quantidade}
          />

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

      <ProdutosRelacionados atual={produto} />
    </div>
  );
}
