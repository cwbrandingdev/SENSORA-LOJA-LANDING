import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Página não encontrada",
};

// 404 do site: vela apagada soltando fumaça ao lado do texto.
export default function NotFound() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 pt-12 lg:px-10">
      <div className="flex flex-col items-center gap-12 lg:flex-row lg:justify-center lg:gap-20">
        <div
          className="relative flex h-56 w-32 shrink-0 flex-col items-center justify-end"
          aria-hidden
        >
          <span className="absolute top-0 h-16 w-3 animate-pulse rounded-full bg-slate-300/50 blur-md" />
          <span className="absolute top-10 h-10 w-2 animate-pulse rounded-full bg-slate-300/60 blur-sm [animation-delay:400ms]" />
          <span className="mb-0.5 h-5 w-0.5 rounded-full bg-slate-700" />
          <span className="h-28 w-24 rounded-t-md bg-[#f4ece2] shadow-[inset_-10px_0_0_rgba(2,24,61,0.05)] ring-1 ring-brand-navy/10" />
          <span className="h-3 w-28 rounded-full bg-brand-navy/10" />
        </div>
        <div className="text-center lg:text-left">
          <p className="font-serif text-8xl leading-none text-brand-orange/80 sm:text-9xl">
            404
          </p>
          <h1 className="mt-6 font-serif text-4xl font-normal leading-tight tracking-tight text-brand-navy sm:text-5xl">
            Este aroma{" "}
            <span className="italic text-brand-orange">se dissipou</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-600">
            A página que você procura não existe ou mudou de lugar. Que tal
            recomeçar pela página inicial ou explorar nossas fragrâncias?
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4 justify-center">
            <Link
              href="/"
              className="bg-brand-navy px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-orange"
            >
              Voltar ao início
            </Link>
            <Link
              href={ROUTES.LOJA_PRODUTOS}
              className="text-[12px] font-semibold uppercase tracking-[0.2em] text-brand-navy underline-offset-8 hover:underline"
            >
              Ver todos os produtos
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
