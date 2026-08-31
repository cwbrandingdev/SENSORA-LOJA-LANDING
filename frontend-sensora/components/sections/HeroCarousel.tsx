"use client";

import { useEffect, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import MagneticLink from "@/components/ui/MagneticLink";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { HERO_SLIDES } from "@/lib/content";

const AUTOPLAY_MS = 6000;

export default function HeroCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!api) return undefined;

    const onSelect = () => setIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);

    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <section
      aria-label="Destaques Sensora"
      className="relative w-full overflow-hidden bg-brand-navy"
    >
      <Carousel
        setApi={setApi}
        opts={{ loop: true }}
        plugins={[
          Autoplay({
            delay: AUTOPLAY_MS,
            stopOnInteraction: false,
          }),
        ]}
        className="h-screen w-full"
      >
        <CarouselContent className="ml-0 h-screen">
          {HERO_SLIDES.map((slide, slideIndex) => (
            <CarouselItem key={slide.id} className="h-screen pl-0">
              <div className="relative h-full w-full overflow-hidden">
                <div
                  className={`relative h-full w-full transition-transform ease-linear motion-reduce:!scale-100 motion-reduce:!duration-0 ${
                    slideIndex === index
                      ? "duration-[9000ms] scale-[1.025]"
                      : "duration-0 scale-100"
                  }`}
                >
                  <PlaceholderImage
                    src={slide.imageSrc}
                    alt={slide.imageAlt}
                    label={slide.title}
                    priority={slideIndex === 0}
                    className="h-full w-full object-cover"
                    sizes={slideIndex === 0 ? "100vw" : undefined}
                  />
                </div>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
                />
                <div
                  className={`absolute inset-x-0 bottom-0 flex flex-col items-center px-6 text-center text-white ${
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
                          : `text-sm font-light text-white/80 sm:text-base ${
                              slide.id === "velas-4-estacoes"
                                ? "mt-2 max-w-lg sm:mt-4 lg:max-w-2xl"
                                : "mt-4 max-w-md"
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
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}
