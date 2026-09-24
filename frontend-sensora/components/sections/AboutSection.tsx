import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ImageReveal from "@/components/ui/ImageReveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import TextReveal from "@/components/ui/TextReveal";
import { ABOUT_CONTENT } from "@/lib/content";
import { ROTAS_LEGAIS } from "@/lib/empresa";

// Frase de fechamento do 2º parágrafo, usada como citação em destaque.
const CITACAO = "Uma casa bem perfumada não é apenas percebida — ela é sentida.";

export default function AboutSection() {
  return (
    <section
      aria-labelledby="sobre-heading"
      className="relative overflow-hidden bg-[#f5f2ed] pt-15 pb-28 sm:pt-22 sm:pb-36 lg:pt-26 lg:pb-40"
    >
      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-[minmax(0,28rem)_1fr] lg:gap-24">
          {/* Foto em arco (ecoando a arquitetura da própria foto) com
              contorno laranja fino e um "sol" em degradê nascendo atrás do
              topo, deslocado para o lado do texto. */}
          <RevealOnScroll className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative">
              <div
                aria-hidden
                className="absolute -right-10 -top-10 aspect-square w-[62%] rounded-full bg-linear-to-b from-[#f3c9a8] to-brand-orange/70 opacity-80 sm:-right-16"
              />
              <div
                aria-hidden
                className="absolute -inset-3 z-10 rounded-t-full border border-brand-orange/40"
              />
              <div className="relative z-10 aspect-3/4 w-full overflow-hidden rounded-t-full bg-white shadow-2xl shadow-brand-navy/15">
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
                      // No lg+: coluna fixa de até 28rem (448px).
                      sizes="(max-width: 495px) calc(100vw - 48px), 448px"
                    />
                  </ImageReveal>
                </div>
              </div>
              <div aria-hidden className="absolute -inset-x-4 -bottom-3 z-10 h-px bg-brand-navy/20" />
            </div>
          </RevealOnScroll>

          <RevealOnScroll delayMs={150} className="text-center lg:pr-10 lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
              {ABOUT_CONTENT.eyebrow}
            </p>
            <h2
              id="sobre-heading"
              className="mt-4 font-serif text-4xl leading-[1.05] font-normal tracking-tight text-brand-navy sm:text-5xl"
            >
              <TextReveal>{ABOUT_CONTENT.title}</TextReveal>
            </h2>
            <span className="mx-auto mt-6 block h-px w-10 bg-brand-orange/60 lg:mx-0" aria-hidden />
            <p className="mt-6 font-serif text-lg italic leading-snug text-brand-navy/70">
              “{CITACAO}”
            </p>
            <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-slate-600">
              {ABOUT_CONTENT.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <Link
              href={ROTAS_LEGAIS.quemSomos}
              className="group mt-8 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-brand-navy transition-colors hover:text-brand-orange"
            >
              Quem somos e CNPJ
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={1.75}
              />
            </Link>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
