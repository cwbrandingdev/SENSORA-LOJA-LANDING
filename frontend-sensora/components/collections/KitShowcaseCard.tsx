"use client";

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Button from "@/components/ui/Button";
import ImageReveal from "@/components/ui/ImageReveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import type { KitShowcase } from "@/lib/content";

type KitShowcaseCardProps = {
  kit: KitShowcase;
};

// Painel "spotlight" do Kit 4 Estações: imagem de um lado, texto do outro,
// dentro de um painel com fundo suave (mesmo #f5f2ed já usado em outras
// seções). UMA imagem só, mostrando o kit físico — nunca os 4 itens que o
// compõem (isso é papel do CollectionShowcase, usado pela vitrine "Velas 4
// Estações" logo acima).
//
// Interação de destaque: um brilho suave (terracota, baixa opacidade,
// mix-blend soft-light) segue o cursor dentro da imagem — mesmo espírito
// do "spotlight card" de referência, mas contido e sóbrio, nunca neon. Só
// se move com mouse de verdade (nunca touch) e nunca com
// prefers-reduced-motion — mesmo padrão já usado em MagneticLink.tsx (sem
// framer-motion, só pointer events + CSS).
export default function KitShowcaseCard({ kit }: KitShowcaseCardProps) {
  const href = kit.lojaSlug ? LOJA_PRODUTO_URL(kit.lojaSlug) : null;
  const imagemRemota = kit.imageSrc.startsWith("http");
  const glowRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = glowRef.current;
    if (!el) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--spotlight-x", `${x}%`);
    el.style.setProperty("--spotlight-y", `${y}%`);
  }

  const imagem = (
    <div
      onPointerMove={handlePointerMove}
      className="relative aspect-[4/5] w-full overflow-hidden rounded-sm shadow-lg shadow-brand-navy/10 transition-shadow duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:aspect-[3/4] pointer-fine:group-hover:shadow-2xl pointer-fine:group-hover:shadow-brand-navy/15"
    >
      <ImageReveal>
        <PlaceholderImage
          src={kit.imageSrc}
          alt={kit.imageAlt}
          label={kit.name}
          unoptimized={imagemRemota}
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
          className="transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] pointer-fine:group-hover:scale-[1.03]"
        />
      </ImageReveal>
      <div
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-500 [background:radial-gradient(circle_at_var(--spotlight-x,50%)_var(--spotlight-y,50%),rgba(196,90,49,0.55),transparent_58%)] pointer-fine:group-hover:opacity-100"
      />
    </div>
  );

  const texto = (
    <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
        {kit.eyebrow ?? "Kit"}
      </p>
      <h2 className="mt-3 font-serif text-2xl font-normal text-brand-navy transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:text-3xl pointer-fine:group-hover:-translate-y-0.5">
        {kit.name}
      </h2>
      {kit.specs && (
        <span className="mt-3 inline-flex items-center rounded-full border border-brand-navy/15 px-3 py-1 text-[11px] font-medium tracking-wide text-brand-navy/70">
          {kit.specs}
        </span>
      )}
      {kit.tagline && (
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600 sm:text-base">
          {kit.tagline}
        </p>
      )}
      {kit.seasons && kit.seasons.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:justify-start">
          {kit.seasons.map((season, index) => (
            <span key={season} className="flex items-center gap-2">
              {index > 0 && (
                <span aria-hidden className="h-1 w-1 rounded-full bg-brand-navy/25" />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-navy/55">
                {season}
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="mt-7">
        {href ? (
          <Button href={href} variant="primary">
            Conhecer kit →
          </Button>
        ) : (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Em breve
          </p>
        )}
      </div>
    </div>
  );

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40">
      <RevealOnScroll className="group grid grid-cols-1 items-center gap-8 rounded-sm bg-[#f5f2ed] p-6 transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:grid-cols-2 sm:gap-10 sm:p-10 lg:gap-16 lg:p-14 pointer-fine:hover:-translate-y-1 pointer-fine:hover:shadow-xl pointer-fine:hover:shadow-brand-navy/10">
        {imagem}
        {texto}
      </RevealOnScroll>
    </section>
  );
}
