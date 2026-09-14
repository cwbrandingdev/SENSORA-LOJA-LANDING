"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import LatestReleaseCard, { type ReleaseItem } from "./LatestReleaseCard";

const arrowClass =
  "h-10 w-10 border-0 bg-white/85 text-brand-navy shadow-[0_2px_10px_rgba(15,23,42,0.12)] hover:bg-white hover:text-brand-navy-light hover:scale-100 disabled:opacity-0";

export default function LatestReleasesCarousel({
  produtos,
}: {
  produtos: ReleaseItem[];
}) {
  return (
    <Carousel opts={{ align: "start", loop: false }} className="w-full">
      <CarouselContent className="-ml-3">
        {produtos.map((produto) => (
          <CarouselItem
            key={produto.key}
            className="basis-[85%] pl-3 sm:basis-1/2 lg:basis-1/4"
          >
            <LatestReleaseCard produto={produto} />
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious
        aria-label="Produtos anteriores"
        className={`${arrowClass} top-[38%] -left-1 lg:left-1`}
      />
      <CarouselNext
        aria-label="Próximos produtos"
        className={`${arrowClass} top-[38%] -right-1 lg:right-1`}
      />
    </Carousel>
  );
}
