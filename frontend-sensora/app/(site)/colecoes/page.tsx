import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { listarColecoesPublicas } from "@/lib/api-publica";

export const metadata: Metadata = {
  title: "Coleções",
  description: "Coleções especiais da Sensora para as datas mais importantes do ano.",
  alternates: { canonical: "/colecoes" },
};

// Índice das coleções de datas festivas ligadas no Admin. (Os kits, que
// moravam neste endereço, agora ficam em /kits.)
export default async function ColecoesPage() {
  const colecoes = await listarColecoesPublicas();

  return (
    <>
      <section className="mx-auto max-w-3xl px-6 py-8 text-center lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">Sensora</p>
          <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:mt-16 sm:text-5xl">
            Coleções
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-600">
            Aromas escolhidos para as datas mais especiais do ano.
          </p>
        </RevealOnScroll>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-10">
        {colecoes.length === 0 ? (
          <EmptyState title="Novidades a caminho" message="Em breve, novas coleções especiais por aqui." />
        ) : (
          <div className="flex flex-wrap justify-center gap-5">
            {colecoes.map((colecao, index) => (
              <RevealOnScroll
                key={colecao.id}
                delayMs={index * 120}
                className="w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc((100%-2.5rem)/3)]"
              >
                <Link
                  href={`/colecoes/${colecao.slug}`}
                  className="group relative block aspect-3/4 w-full overflow-hidden rounded-sm bg-brand-navy shadow-lg shadow-brand-navy/10"
                >
                  <PlaceholderImage
                    src={colecao.imagemUrl || undefined}
                    alt={colecao.nome}
                    label={colecao.nome}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="transition-transform duration-1600 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-start p-6 text-left sm:p-8">
                    <h2 className="font-serif text-2xl font-normal text-white sm:text-3xl">{colecao.nome}</h2>
                    {colecao.descricao && <p className="mt-2 text-sm text-white/75">{colecao.descricao}</p>}
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-orange-light">
                      Ver coleção
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                        strokeWidth={1.75}
                      />
                    </span>
                  </div>
                </Link>
              </RevealOnScroll>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
