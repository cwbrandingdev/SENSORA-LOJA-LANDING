"use client";

import { useEffect, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import Link from "next/link";
import { getImageProps } from "next/image";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import type { HeroSlide } from "@/lib/content";

const AUTOPLAY_MS = 6000;
const ALTURA_BANNER =
  "h-[calc(100vh-var(--navbar-height)-var(--faixa-cupom))] lg:h-[min(calc(100vh-var(--navbar-height)-var(--faixa-cupom)),37.5vw)]";

// Slide com arte de celular e de computador: um <picture> só, para o
// navegador baixar apenas a arte da tela atual. Com duas <Image> (uma
// escondida por CSS) e preload nas duas, o celular baixava também a arte
// grande do computador e a imagem principal demorava a aparecer. O 1º
// slide vai com prioridade alta (é a imagem principal da home).
function BannerArteDirecionada({
  mobile,
  desktop,
  alt,
  prioritario,
}: {
  mobile: string;
  desktop: string;
  alt: string;
  prioritario: boolean;
}) {
  const comum = { alt, fill: true, sizes: "100vw" } as const;
  const {
    props: { srcSet: srcSetDesktop },
  } = getImageProps({ ...comum, src: desktop });
  const {
    props: { srcSet: srcSetMobile, ...img },
  } = getImageProps({
    ...comum,
    src: mobile,
    loading: prioritario ? "eager" : "lazy",
    fetchPriority: prioritario ? "high" : "auto",
  });

  return (
    <picture>
      {/* lg (1024px): mesmo ponto em que o site troca para o layout de computador. */}
      <source media="(min-width: 1024px)" srcSet={srcSetDesktop} />
      <source srcSet={srcSetMobile} />
      {/* <img> com as props otimizadas de getImageProps (modelo oficial de art direction do Next). */}
      <img {...img} alt={alt} className="object-cover" />
    </picture>
  );
}

export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  // Só a foto do 1º slide entra no carregamento inicial; as dos outros
  // (fora da tela, mas baixadas cedo por estarem ao lado no trilho) vêm
  // 2s depois ou assim que a pessoa mexer no carrossel. Libera a banda do
  // celular para o que aparece no topo (PageSpeed mobile).
  const [carregarDemais, setCarregarDemais] = useState(false);

  useEffect(() => {
    const espera = window.setTimeout(() => setCarregarDemais(true), 2000);
    return () => window.clearTimeout(espera);
  }, []);

  useEffect(() => {
    if (!api) return undefined;

    // Toda troca de slide (setas, teclado, swipe) reinicia o autoplay do
    // zero; reset() não faz nada se o autoplay estiver parado.
    const onSelect = () => {
      const atual = api.selectedScrollSnap();
      setIndex(atual);
      if (atual !== 0) setCarregarDemais(true);
      api.plugins().autoplay?.reset();
    };
    const onPointerDown = () => setCarregarDemais(true);
    onSelect();
    api.on("select", onSelect);
    api.on("pointerDown", onPointerDown);

    return () => {
      api.off("select", onSelect);
      api.off("pointerDown", onPointerDown);
    };
  }, [api]);

  return (
    <section
      aria-label="Destaques Sensora"
      className="relative w-full overflow-hidden bg-brand-navy"
    >
      {/* Título principal da home para buscadores, agentes e leitores de
          tela. Fica aqui dentro (e não antes do carrossel na página) para
          não criar um bloco visível acima do hero. */}
      <h1 className="sr-only">
        Sensora: velas aromáticas, sprays e difusores de ambiente
      </h1>
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        plugins={[
          Autoplay({
            delay: AUTOPLAY_MS,
            stopOnInteraction: false,
          }),
        ]}
        className={`${ALTURA_BANNER} w-full`}
      >
        <CarouselContent
          className={`ml-0 ${ALTURA_BANNER} max-sm:touch-pan-y max-sm:touch-pinch-zoom`}
        >
          {slides.map((slide, slideIndex) => (
            <CarouselItem key={slide.id} className={`${ALTURA_BANNER} pl-0`}>
              <div className="relative block h-full w-full overflow-hidden">
                <div
                  className={`relative h-full w-full motion-reduce:!scale-100 motion-reduce:!duration-0 sm:transition-transform sm:ease-linear ${
                    slideIndex === index
                      ? "sm:duration-[9000ms] sm:scale-[1.025]"
                      : "sm:duration-0 sm:scale-100"
                  }`}
                >
                  {slideIndex > 0 &&
                  !carregarDemais ? null : slide.imageSrcMobile &&
                    slide.imageSrc ? (
                    <BannerArteDirecionada
                      mobile={slide.imageSrcMobile}
                      desktop={slide.imageSrc}
                      alt={slide.imageAlt}
                      prioritario={slideIndex === 0}
                    />
                  ) : (
                    <PlaceholderImage
                      src={slide.imageSrc}
                      alt={slide.imageAlt}
                      label={slide.title}
                      priority={slideIndex === 0}
                      className="h-full w-full object-cover"
                      sizes={slideIndex === 0 ? "100vw" : undefined}
                    />
                  )}
                </div>
                {/* Arte com botão desenhado: o banner inteiro é o link, sem
                    degradê e sem o nosso botão (o texto continua por cima). */}
                {slide.arteCompleta && (
                  <Link
                    href={slide.ctaHref}
                    aria-label={`${slide.title} — ${slide.ctaLabel}`}
                    className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
                  />
                )}
                {!slide.arteCompleta && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
                  />
                )}
                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center text-center text-white ${
                    slide.id === "velas-4-estacoes"
                      ? "pb-8 sm:pb-20"
                      : "pb-16 sm:pb-20"
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
                          : `text-sm font-light text-white sm:text-[18px] ${
                              slide.id === "velas-4-estacoes"
                                ? "mt-2 max-w-lg sm:mt-4 lg:max-w-2xl"
                                : "mt-4 max-w-md"
                            }`
                      }
                    >
                      {slide.subtitle}
                    </p>
                  )}
                  {!slide.arteCompleta && (
                    <Link
                      href={slide.ctaHref}
                      aria-label={`${slide.title} — ${slide.ctaLabel}`}
                      className={`group/cta pointer-events-auto inline-flex items-center gap-3 border border-white/70 px-9 py-3.5 text-xs font-semibold uppercase tracking-[0.25em] text-white transition-[color,background-color,border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-brand-orange hover:bg-brand-orange focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy motion-reduce:transition-colors ${
                        slide.id === "velas-4-estacoes"
                          ? "mt-5 sm:mt-8"
                          : "mt-8"
                      }`}
                    >
                      {slide.ctaLabel}
                      <span
                        aria-hidden
                        className="transition-transform duration-300 group-hover/cta:translate-x-1"
                      >
                        →
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Pontinhos no lugar das setas: o do slide atual vira um traço. */}
        <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2 sm:bottom-6">
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => api?.scrollTo(slideIndex)}
              aria-label={`Ir para o slide ${slideIndex + 1}`}
              aria-current={slideIndex === index}
              className={`h-2.5 rounded-full bg-white shadow-sm transition-all duration-300 ${
                slideIndex === index
                  ? "w-8"
                  : "w-2.5 opacity-70 hover:opacity-100"
              }`}
            />
          ))}
        </div>
      </Carousel>
    </section>
  );
}
