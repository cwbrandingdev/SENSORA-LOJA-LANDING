"use client";

// Fotos da página do produto: a 1ª (capa) aparece grande; com mais de uma,
// dá para arrastar para o lado (celular) ou tocar nas miniaturas. Mesmo
// carrossel do hero (components/ui/carousel).
import { useEffect, useState } from "react";
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
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-sm bg-brand-navy">
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
      </div>

      {imagens.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
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
