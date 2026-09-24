import Link from "next/link";
import { ArrowRight } from "lucide-react";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import LatestReleasesCarousel from "./LatestReleasesCarousel";
import type { ReleaseItem } from "./LatestReleaseCard";

export type GrupoLancamentos = {
  id: string;
  label: string;
  href: string;
  produtos: ReleaseItem[];
};

export default function LatestReleasesGroups({ grupos }: { grupos: GrupoLancamentos[] }) {
  return (
    <div className="flex flex-col gap-14 sm:gap-20">
      {grupos.map((grupo) => {
        const headingId = `lancamentos-${grupo.id}`;
        return (
          <RevealOnScroll key={grupo.id}>
            <div role="group" aria-labelledby={headingId}>
              {/* Título serif em itálico centralizado entre dois fios que
                  esmaecem nas pontas, com "Ver todos" discreto logo abaixo. */}
              <div className="mb-8 flex flex-col items-center text-center">
                <div className="flex w-full items-center gap-4 sm:gap-6">
                  <span
                    className="h-px flex-1 bg-linear-to-r from-transparent to-brand-navy/20"
                    aria-hidden
                  />
                  <h3
                    id={headingId}
                    className="font-serif text-2xl font-normal italic tracking-tight text-brand-navy sm:text-[1.9rem]"
                  >
                    {grupo.label}
                  </h3>
                  <span
                    className="h-px flex-1 bg-linear-to-l from-transparent to-brand-navy/20"
                    aria-hidden
                  />
                </div>
                <Link
                  href={grupo.href}
                  className="group mt-3 inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-orange transition-colors hover:text-brand-navy"
                >
                  Ver todos
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={1.75}
                  />
                </Link>
              </div>

              <LatestReleasesCarousel produtos={grupo.produtos} />
            </div>
          </RevealOnScroll>
        );
      })}
    </div>
  );
}
