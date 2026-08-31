// Home da vitrine da Loja — mesmo padrão editorial das páginas de categoria
// ([category]/page.tsx, colecoes/page.tsx): hero compacto de texto (eyebrow +
// H1 + descrição), sem hero full-bleed próprio. Reaproveita RevealOnScroll,
// ImageReveal, TextReveal, PlaceholderImage, ProductGrid, Button — nenhuma
// imagem nova, nenhuma dependência nova.
import type { Metadata } from "next";
import Link from "next/link";
import {
  ApiPublicaIndisponivelError,
  listarCategoriasPublicasOuFalha,
  listarProdutosPublicosOuFalha,
} from "@/lib/api-publica";
import { bannerParaCategoria } from "@/lib/loja-imagens";
import { ROUTES } from "@/lib/routes";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import ImageReveal from "@/components/ui/ImageReveal";
import TextReveal from "@/components/ui/TextReveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import ProductGrid from "@/components/loja/ProductGrid";
import Button from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Loja",
};

export default async function LojaPage() {
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
            Não foi possível carregar a loja agora
          </h1>
          <p className="text-base leading-relaxed text-slate-600">
            Tente novamente em instantes.
          </p>
          <Link
            href={ROUTES.LOJA}
            className="mt-2 text-[13px] uppercase tracking-[0.14em] text-brand-navy underline underline-offset-4"
          >
            Tentar novamente
          </Link>
        </div>
      );
    }
    throw err;
  }

  const destaques = produtos.filter((produto) => produto.destaque);

  return (
    <>
      <section className="relative mx-auto max-w-3xl overflow-hidden px-6 pt-28 pb-8 text-center sm:pt-36 lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Loja
          </p>
          <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
            A loja Sensora
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-600">
            Velas, difusores e sprays de ambiente.
          </p>
          <div className="mt-9 flex justify-center">
            <Button href={ROUTES.LOJA_PRODUTOS} variant="primary">
              Ver catálogo completo →
            </Button>
          </div>
        </RevealOnScroll>
      </section>

      {categorias.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40">
          <RevealOnScroll className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
              Sensora
            </p>
            <h2 className="mt-4 font-serif text-3xl font-normal text-brand-navy sm:text-4xl">
              <TextReveal>Categorias</TextReveal>
            </h2>
          </RevealOnScroll>

          <div className="mt-16 grid grid-cols-1 gap-6 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
            {categorias.map((categoria, index) => {
              const banner = bannerParaCategoria(categoria.slug);
              return (
                <RevealOnScroll
                  key={categoria.id}
                  delayMs={index * 90}
                  className="text-center"
                >
                  <Link
                    href={`${ROUTES.LOJA_PRODUTOS}?categoria=${encodeURIComponent(categoria.slug)}`}
                    className="group block"
                  >
                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm">
                      <ImageReveal>
                        <PlaceholderImage
                          src={banner ?? undefined}
                          alt={categoria.nome}
                          label={categoria.nome}
                          sizes="(min-width: 1024px) 33vw, 50vw"
                          className="transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      </ImageReveal>
                    </div>
                    <h3 className="mt-4 font-serif text-xl font-normal text-brand-navy">
                      {categoria.nome}
                    </h3>
                  </Link>
                </RevealOnScroll>
              );
            })}
          </div>
        </section>
      )}

      {destaques.length > 0 && (
        <section className="bg-[#f5f2ed] px-6 py-24 sm:py-32 lg:px-10 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <RevealOnScroll className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
                Sensora
              </p>
              <h2 className="mt-4 font-serif text-3xl font-normal text-brand-navy sm:text-4xl">
                <TextReveal>Em destaque</TextReveal>
              </h2>
            </RevealOnScroll>

            <div className="mt-16 sm:mt-20">
              <ProductGrid produtos={destaques} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
