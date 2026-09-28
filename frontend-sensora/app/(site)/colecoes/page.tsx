import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ImageReveal from "@/components/ui/ImageReveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { COLLECTIONS, getCollectionHref, type Collection } from "@/lib/content";

// Ponto de foco de cada banner: as fotos são panorâmicas e os produtos não
// ficam no meio. Sem isso, o corte em retrato dos cartões (object-cover,
// centro 50%) deixa os produtos de lado. Valores medidos nas próprias
// imagens — ao trocar a foto de uma coleção, conferir de novo.
const FOCO: Record<string, string> = {
  "4-estacoes": "object-[31%_50%]",
  "sprays-de-ambiente": "object-[51%_50%]",
  "difusores-de-aroma": "object-[35%_50%]",
};

function rotuloAromas(collection: Collection) {
  const total = collection.items.length;
  return `${collection.eyebrow ?? "Kit"} · ${total} ${total === 1 ? "aroma" : "aromas"}`;
}

export default function ColecoesPage() {
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
            Conjuntos de produtos criados para contar uma história sensorial
            completa.
          </p>
        </RevealOnScroll>
      </section>

      {/* Grade: as coleções lado a lado em cartões altos, texto sobre a foto.
          Os aromas ficam sempre visíveis no toque; no desktop sobem no hover. */}
      <div className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {COLLECTIONS.map((collection, index) => (
            <RevealOnScroll key={collection.slug} delayMs={index * 120}>
              <Link
                href={getCollectionHref(collection)}
                className="group relative block aspect-3/4 w-full overflow-hidden rounded-sm bg-white shadow-lg shadow-brand-navy/10"
              >
                <ImageReveal>
                  <PlaceholderImage
                    src={collection.heroImageSrc}
                    alt={collection.heroImageAlt ?? collection.name}
                    label={collection.name}
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className={`transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] ${FOCO[collection.slug] ?? ""}`}
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
                    {collection.name}
                  </h2>
                  {collection.tagline && (
                    <p className="mt-2 text-sm text-white/75">{collection.tagline}</p>
                  )}
                  <ul
                    aria-label={rotuloAromas(collection)}
                    className="mt-4 flex flex-wrap gap-1.5 transition-all duration-500 pointer-fine:max-h-0 pointer-fine:opacity-0 pointer-fine:group-hover:max-h-40 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-visible:max-h-40 pointer-fine:group-focus-visible:opacity-100"
                  >
                    {collection.items.map((item) => (
                      <li
                        key={item.slug}
                        className="rounded-full border border-white/40 px-3 py-1 text-[11px] text-white/90"
                      >
                        {item.seasonLabel ?? item.name}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-orange-light">
                    {collection.ctaLabel ?? "Conhecer kit"}
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
      </div>
    </>
  );
}
