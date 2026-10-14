"use client";

// Fotos da página do produto: a 1ª (capa) aparece grande; com mais de uma,
// dá para usar as setas, arrastar para o lado (celular) ou tocar nas
// miniaturas (embaixo no celular, à esquerda no computador). Mesmo
// carrossel do hero (components/ui/carousel).
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ImageReveal from "@/components/ui/ImageReveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { imagemKitRedimensionada } from "@/lib/loja-imagens";
import { cn } from "@/lib/utils";

const setaClass = (lado: string) =>
  cn(
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-brand-navy shadow-sm backdrop-blur-sm transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0",
    lado,
  );

type GaleriaProdutoProps = {
  imagens: string[];
  nome: string;
  destaque: boolean;
};

export default function GaleriaProduto({ imagens, nome, destaque }: GaleriaProdutoProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [ativa, setAtiva] = useState(0);

  useEffect(() => {
    if (!api) return undefined;
    const aoTrocar = () => setAtiva(api.selectedScrollSnap());
    api.on("select", aoTrocar);
    return () => {
      api.off("select", aoTrocar);
    };
  }, [api]);

  // Sem foto: um item só, com o "Imagem em breve" do PlaceholderImage.
  const fotos = imagens.length > 0 ? imagens : [undefined];

  return (
    // Miniaturas vêm depois no HTML (embaixo no celular); no computador o
    // row-reverse as leva para a esquerda da foto.
    <div className="flex flex-col gap-3 lg:flex-row-reverse">
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-sm bg-brand-navy">
        {destaque && (
          <span className="absolute left-4 top-4 z-10 bg-background/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-brand-orange">
            Destaque
          </span>
        )}
        <ImageReveal>
          <Carousel setApi={setApi} aria-label={`Fotos de ${nome}`}>
            <CarouselContent className="ml-0">
              {fotos.map((url, indice) => (
                <CarouselItem key={`${url}-${indice}`} className="relative aspect-[4/5] pl-0 lg:aspect-[3/4]">
                  <PlaceholderImage
                    src={imagemKitRedimensionada(url, 1200)}
                    alt={fotos.length > 1 ? `${nome} — foto ${indice + 1}` : nome}
                    label={nome}
                    priority={indice === 0}
                    unoptimized={Boolean(url)}
                    sizes="(min-width: 1024px) 50vw, 100vw"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </ImageReveal>

        {imagens.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => api?.scrollPrev()}
              disabled={ativa === 0}
              aria-label="Foto anterior"
              className={setaClass("left-3")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => api?.scrollNext()}
              disabled={ativa === imagens.length - 1}
              aria-label="Próxima foto"
              className={setaClass("right-3")}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {imagens.length > 1 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto lg:flex-col lg:overflow-y-auto">
          {imagens.map((url, indice) => (
            <button
              key={`${url}-${indice}`}
              type="button"
              onClick={() => api?.scrollTo(indice)}
              aria-label={`Ver foto ${indice + 1}`}
              aria-current={indice === ativa}
              className={cn(
                "relative h-20 w-16 shrink-0 overflow-hidden rounded-sm border-2 transition-opacity",
                indice === ativa ? "border-brand-navy" : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagemKitRedimensionada(url, 160)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
