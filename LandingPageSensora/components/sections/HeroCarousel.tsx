"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MagneticLink from "@/components/ui/MagneticLink";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import { HERO_SLIDES } from "@/lib/content";

const AUTOPLAY_MS = 6000;

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const total = HERO_SLIDES.length;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (target: number) => {
      setIndex(((target % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (total <= 1) return undefined;

    timerRef.current = setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, AUTOPLAY_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total]);

  return (
    <section
      aria-label="Destaques Sensora"
      className="group relative w-full overflow-hidden bg-brand-navy"
    >
      <div className="relative aspect-[4/5] w-full sm:aspect-[16/9] lg:aspect-auto lg:h-[90vh] lg:max-h-[860px] lg:min-h-[600px]">
        {HERO_SLIDES.map((slide, slideIndex) => (
          <div
            key={slide.id}
            className={`absolute inset-0 overflow-hidden transition-[opacity,transform] duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
              slideIndex === index
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-3 opacity-0"
            }`}
            aria-hidden={slideIndex !== index}
          >
            {/* Zoom quase imperceptível ("Ken Burns") só na imagem ativa — sugere
                profundidade, nunca movimento perceptível. */}
            <div
              className={`relative h-full w-full transition-transform ease-linear motion-reduce:!scale-100 motion-reduce:!duration-0 ${
                slideIndex === index ? "duration-[9000ms] scale-[1.025]" : "duration-0 scale-100"
              }`}
            >
              <PlaceholderImage
                src={slide.imageSrc}
                alt={slide.imageAlt}
                label={slide.title}
                priority={slideIndex === 0}
                // Só o banner inicial (LCP, acima da dobra) precisa do sizes:
                // é full-bleed, sem padding nem max-width no container.
                sizes={slideIndex === 0 ? "100vw" : undefined}
              />
            </div>
            {/* Véu de contraste: os banners mostram o produto até perto da base do
                quadro, então o texto sobreposto precisa de um fundo previsível
                independente da foto — troca os antigos text-shadow por slide,
                que não davam conta o bastante em fundos mais claros/ocupados. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
            />
            <div
              className={`absolute inset-x-0 bottom-0 flex flex-col items-center px-6 text-center text-white ${
                slide.id === "velas-4-estacoes" ? "pb-8 sm:pb-20" : "pb-16 sm:pb-20"
              }`}
            >
              <h2
                className={
                  slide.hideOverlayHeading
                    ? "sr-only"
                    : slide.id === "velas-4-estacoes"
                      ? "max-w-3xl font-serif text-3xl leading-tight font-normal tracking-tight sm:text-6xl lg:text-7xl"
                      : "max-w-3xl font-serif text-4xl leading-tight font-normal tracking-tight sm:text-6xl lg:text-7xl"
                }
              >
                {slide.title}
              </h2>
              {slide.subtitle && (
                <p
                  className={
                    slide.hideOverlayHeading
                      ? "sr-only"
                      : `text-sm font-light text-white/80 sm:text-base ${
                          slide.id === "velas-4-estacoes" ? "mt-2 max-w-lg sm:mt-4 lg:max-w-2xl" : "mt-4 max-w-md"
                        }`
                  }
                >
                  {slide.subtitle}
                </p>
              )}
              <MagneticLink
                href={slide.ctaHref}
                className={`group/cta !inline-flex items-center gap-3 border border-white/70 px-9 py-3.5 text-xs font-semibold uppercase tracking-[0.25em] text-white transition-[color,background-color,border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-brand-orange hover:bg-brand-orange focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy motion-reduce:transition-colors ${
                  slide.id === "velas-4-estacoes" ? "mt-5 sm:mt-8" : "mt-8"
                }`}
              >
                {slide.ctaLabel}
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover/cta:translate-x-1"
                >
                  →
                </span>
              </MagneticLink>
            </div>
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Banner anterior"
            className="absolute left-4 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/40 p-2.5 text-xl leading-none text-white opacity-0 transition-[opacity,border-color,background-color,transform] duration-300 hover:scale-105 hover:border-white hover:bg-white/10 active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/80 group-hover:opacity-100 sm:flex sm:left-6"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Próximo banner"
            className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/40 p-2.5 text-xl leading-none text-white opacity-0 transition-[opacity,border-color,background-color,transform] duration-300 hover:scale-105 hover:border-white hover:bg-white/10 active:scale-95 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/80 group-hover:opacity-100 sm:flex sm:right-6"
          >
            ›
          </button>

          <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-3 px-6 sm:bottom-8 sm:gap-4">
            <span
              aria-hidden
              className="hidden text-[11px] tracking-[0.2em] text-white/70 tabular-nums sm:inline-block"
            >
              {String(index + 1).padStart(2, "0")} — {String(total).padStart(2, "0")}
            </span>
            <div className="flex items-center gap-2">
              {HERO_SLIDES.map((slide, slideIndex) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goTo(slideIndex)}
                  aria-label={`Ir para o banner ${slideIndex + 1}`}
                  aria-current={slideIndex === index}
                  className="h-[3px] w-10 overflow-hidden rounded-full bg-white/30 outline-none transition-colors duration-300 hover:bg-white/50 focus-visible:ring-1 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy sm:w-14"
                >
                  {slideIndex === index && (
                    <span
                      aria-hidden
                      className="block h-full origin-left bg-white motion-reduce:w-full motion-reduce:[animation:none]"
                      style={{ animation: `hero-progress ${AUTOPLAY_MS}ms linear forwards` }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
