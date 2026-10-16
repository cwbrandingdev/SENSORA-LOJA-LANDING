import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ImageReveal from "@/components/ui/ImageReveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import EmptyState from "@/components/ui/EmptyState";
import { listarProdutosPublicos } from "@/lib/api-publica";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import { imagemKitRedimensionada } from "@/lib/loja-imagens";

export const metadata: Metadata = {
  title: "Kits",
  description:
    "Kits Sensora: conjuntos de velas aromáticas, sprays de ambiente e difusores criados para contar uma história sensorial completa.",
  alternates: { canonical: "/colecoes" },
};

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Só entra kit cadastrado no Admin: produto real cuja categoria é a de kits
// (slug "kits", tolerando variações de sufixo — mesmo critério do grupo
// Kits da home em LatestReleases). Coleções editoriais de lib/content.ts
// (Velas 4 Estações, Sprays, Difusores) não aparecem aqui.
export default async function ColecoesPage() {
  const produtos = await listarProdutosPublicos();
  const kits = produtos.filter((produto) =>
    produto.categoria?.slug.startsWith("kit"),
  );

  return (
    <>
      <section className="relative mx-auto max-w-3xl overflow-hidden px-6 py-8 text-center lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Sensora
          </p>
          <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:mt-16 sm:text-5xl">
            Kits
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-600">
            Seus aromas favoritos, reunidos em combinações especiais.
          </p>
        </RevealOnScroll>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40">
        {kits.length === 0 ? (
          <EmptyState
            title="Novidades a caminho"
            message="Em breve, novos kits por aqui."
          />
        ) : (
          /* Cartões altos com texto sobre a foto, centralizados como grupo
             quando há menos kits do que colunas. */
          <div className="flex flex-wrap justify-center gap-5">
            {kits.map((kit, index) => (
              <RevealOnScroll
                key={kit.id}
                delayMs={index * 120}
                className="w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc((100%-2.5rem)/3)]"
              >
                <Link
                  href={LOJA_PRODUTO_URL(kit.slug)}
                  className="group relative block aspect-3/4 w-full overflow-hidden rounded-sm bg-white shadow-lg shadow-brand-navy/10"
                >
                  <ImageReveal>
                    <PlaceholderImage
                      src={
                        kit.imagemUrl
                          ? imagemKitRedimensionada(kit.imagemUrl, 900)
                          : undefined
                      }
                      alt={kit.nome}
                      label={kit.nome}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      unoptimized={kit.imagemUrl?.startsWith(
                        "https://ik.imagekit.io",
                      )}
                      className="transition-transform duration-1600 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                    />
                  </ImageReveal>
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-start p-6 text-left sm:p-8">
                    <span className="font-serif text-sm text-brand-orange-light">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2 className="mt-2 font-serif text-2xl font-normal text-white sm:text-3xl">
                      {kit.nome}
                    </h2>
                    {kit.aroma && kit.aroma !== kit.nome && (
                      <p className="mt-2 text-sm text-white/75">{kit.aroma}</p>
                    )}
                    <p className="mt-3 text-base font-medium tabular-nums text-white">
                      {formatPrice.format(kit.preco)}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-orange-light">
                      Conhecer kit
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                        strokeWidth={1.75}
                      />
                    </span>
                  </div>
                </Link>
              </RevealOnScroll>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
