import Button from "@/components/ui/Button";
import ImageReveal from "@/components/ui/ImageReveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import TextReveal from "@/components/ui/TextReveal";
import { LOJA_URL } from "@/lib/config";
import type { Collection } from "@/lib/content";

type CollectionShowcaseProps = {
  collection: Collection;
};

// Vitrine editorial de uma coleção: apresenta, não vende — nenhum item da
// grade é clicável, o único caminho de conversão é o CTA final para a loja.
export default function CollectionShowcase({ collection }: CollectionShowcaseProps) {
  const headingId = `${collection.slug}-heading`;

  return (
    <section aria-labelledby={headingId} className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40">
      {collection.heroImageSrc && (
        <RevealOnScroll className="relative mx-auto aspect-[21/9] w-full max-w-6xl overflow-hidden rounded-sm shadow-2xl shadow-brand-navy/10">
          <ImageReveal>
            <PlaceholderImage src={collection.heroImageSrc} alt={collection.heroImageAlt ?? collection.name} label={collection.name} />
          </ImageReveal>
        </RevealOnScroll>
      )}

      <RevealOnScroll className="mx-auto mt-12 max-w-3xl text-center sm:mt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">{collection.eyebrow ?? "Kit"}</p>
        <h2 id={headingId} className="mt-4 font-serif text-3xl font-normal tracking-tight text-brand-navy sm:text-4xl">
          <TextReveal>{collection.name}</TextReveal>
        </h2>
        {collection.tagline && (
          <p className="mt-3 text-sm font-light text-slate-500 sm:text-base">{collection.tagline}</p>
        )}
        <p className="mt-6 text-base leading-relaxed text-slate-600">{collection.description}</p>
      </RevealOnScroll>

      {/* Flex + justify-center em vez de grid: com uma Collection de menos de
          4 itens (Sprays, Difusores), os cards centralizam como grupo na
          linha em vez de ficar alinhados à esquerda com uma coluna vazia à
          direita. As larguras replicam exatamente as colunas do grid antigo
          (25% menos a fatia do gap-x-6), então 4 itens (Velas) preenchem a
          linha de ponta a ponta como antes — sem mudança visual pra eles. */}
      <div className="mx-auto mt-16 flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-10 sm:mt-20 sm:gap-y-14">
        {collection.items.map((item, index) => (
          <RevealOnScroll
            key={item.slug}
            delayMs={index * 90}
            className="group w-full text-center sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]"
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm shadow-md shadow-brand-navy/10 transition-shadow duration-700 group-hover:shadow-lg group-hover:shadow-brand-navy/15">
              <ImageReveal>
                <PlaceholderImage
                  src={item.imageSrc}
                  alt={item.imageAlt}
                  label={item.name}
                  // Grid de 1/2/4 colunas dentro de um container max-w-6xl (1152px)
                  // com gap-x-6; acima de 1231px de viewport o grid já está no teto.
                  sizes="(max-width: 639px) calc(100vw - 48px), (max-width: 1023px) calc(50vw - 36px), (max-width: 1231px) calc(25vw - 38px), 270px"
                  className="transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]"
                />
              </ImageReveal>
            </div>
            {item.seasonLabel && (
              <div className="mt-5 flex items-center justify-center gap-2.5">
                <span aria-hidden className="h-px w-5 bg-brand-orange/40" />
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-orange">
                  {item.seasonLabel}
                </p>
                <span aria-hidden className="h-px w-5 bg-brand-orange/40" />
              </div>
            )}
            <h3 className="mt-3 font-serif text-xl font-normal text-brand-navy transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5">
              {item.name}
            </h3>
            {item.mood && <p className="mx-auto mt-2 max-w-[26ch] text-sm leading-relaxed text-slate-600">{item.mood}</p>}
          </RevealOnScroll>
        ))}
      </div>

      <RevealOnScroll className="mt-16 flex justify-center sm:mt-20">
        <Button href={LOJA_URL} variant="primary">
          {collection.ctaLabel ?? "Conhecer kit"} →
        </Button>
      </RevealOnScroll>
    </section>
  );
}
