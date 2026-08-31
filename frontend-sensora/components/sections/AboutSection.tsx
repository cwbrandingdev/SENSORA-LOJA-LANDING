import ImageReveal from "@/components/ui/ImageReveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import TextReveal from "@/components/ui/TextReveal";
import { ABOUT_CONTENT } from "@/lib/content";

export default function AboutSection() {
  return (
    <section
      aria-labelledby="sobre-heading"
      className="relative overflow-hidden bg-[#f5f2ed] py-28 sm:py-36 lg:py-40"
    >
      {/* Acento de margem: uma barra sólida (direita), vivendo na calha vazia
          fora da coluna de conteúdo. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 top-[13rem] hidden h-56 w-[3px] rounded-full bg-white/70 sm:block lg:right-6"
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-24 lg:px-10">
        <RevealOnScroll className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
          <div className="relative z-10 aspect-[4/5] w-full overflow-hidden rounded-sm bg-white shadow-2xl shadow-brand-navy/15">
            {/* Parallax (CSS puro, ver globals.css) na camada externa; o
                reveal de entrada (fade + leve zoom) na interna — os dois
                transforms vivem em elementos separados para não colidir. */}
            <div className="parallax-drift relative h-full w-full">
              <ImageReveal>
                <PlaceholderImage
                  src={ABOUT_CONTENT.imageSrc}
                  alt={ABOUT_CONTENT.imageAlt}
                  label={ABOUT_CONTENT.title}
                  // Abaixo do lg: largura cheia limitada por max-w-md (448px).
                  // No lg+: metade do grid de 2 colunas (max-w-7xl, gap-24, px-10).
                  sizes="(max-width: 495px) calc(100vw - 48px), (max-width: 1023px) 448px, (max-width: 1280px) calc(50vw - 88px), 552px"
                />
              </ImageReveal>
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delayMs={150} className="lg:pr-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            {ABOUT_CONTENT.eyebrow}
          </p>
          <h2
            id="sobre-heading"
            className="mt-4 font-serif text-4xl leading-[1.05] font-normal tracking-tight text-brand-navy sm:text-5xl"
          >
            <TextReveal>{ABOUT_CONTENT.title}</TextReveal>
          </h2>
          <div className="mt-8 max-w-xl space-y-6 text-base leading-relaxed text-slate-600">
            {ABOUT_CONTENT.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
