import Link from "next/link";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import ImageReveal from "@/components/ui/ImageReveal";
import { COLLECTIONS, getCollectionHref } from "@/lib/content";

export default function ColecoesPage() {
  return (
    <>
      <section className="relative mx-auto max-w-3xl overflow-hidden px-6 pt-28 pb-8 text-center sm:pt-36 lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Sensora
          </p>
          <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
            Kits
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-600">
            Conjuntos de produtos criados para contar uma história sensorial
            completa.
          </p>
        </RevealOnScroll>
      </section>

      <div className="relative isolate mx-auto flex max-w-6xl flex-col gap-14 px-6 pb-24 sm:gap-20 sm:pb-32 lg:px-10 lg:pb-40">
        {COLLECTIONS.map((collection, index) => {
          const totalAromas = collection.items.length;
          return (
            <RevealOnScroll key={collection.slug} delayMs={index * 120}>
              <Link href={getCollectionHref(collection)} className="group block">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm shadow-lg shadow-brand-navy/10 transition-shadow duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:shadow-2xl group-hover:shadow-brand-navy/20 sm:aspect-[16/10] lg:aspect-[21/9]">
                  <ImageReveal>
                    <PlaceholderImage
                      src={collection.heroImageSrc}
                      alt={collection.heroImageAlt ?? collection.name}
                      label={collection.name}
                      sizes="(min-width: 1024px) 1152px, 100vw"
                      className="transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                    />
                  </ImageReveal>
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent transition-opacity duration-700 group-hover:from-black/85"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-brand-orange-light">
                      {collection.eyebrow ?? "Kit"} · {totalAromas} {totalAromas === 1 ? "aroma" : "aromas"}
                    </p>
                    <h2 className="mt-2 font-serif text-2xl font-normal text-white transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 sm:text-3xl">
                      {collection.name}
                    </h2>
                    {collection.tagline && (
                      <p className="mt-1.5 max-w-md text-sm text-white/75 sm:text-base">
                        {collection.tagline}
                      </p>
                    )}
                    <span className="mt-4 flex translate-y-0 items-center gap-1.5 text-xs uppercase tracking-widest text-brand-orange-light opacity-100 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-fine:translate-y-1 pointer-fine:opacity-0 pointer-fine:group-hover:translate-y-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-visible:translate-y-0 pointer-fine:group-focus-visible:opacity-100">
                      {collection.ctaLabel ?? "Conhecer kit"} →
                    </span>
                  </div>
                </div>
              </Link>
            </RevealOnScroll>
          );
        })}
      </div>
    </>
  );
}
