import { BadgeCheck } from "lucide-react";
import Estrelas from "@/components/loja/Estrelas";
import type { ResumoAvaliacoes } from "@/lib/types/loja";

// Seção "Avaliações" da página do produto: só as aprovadas no Admin, todas
// de quem comprou e confirmou o recebimento ("Compra verificada").
const formatarData = (data: string) =>
  new Date(data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default function AvaliacoesProduto({ resumo }: { resumo: ResumoAvaliacoes }) {
  return (
    <section
      id="avaliacoes"
      aria-labelledby="avaliacoes-heading"
      className="mt-12 scroll-mt-32 border-t border-slate-200 pt-10 sm:mt-16 sm:pt-12"
    >
      <h2 id="avaliacoes-heading" className="font-serif text-3xl font-normal text-brand-navy">
        Avaliações
      </h2>

      {resumo.total === 0 || resumo.media === null ? (
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600">
          Este produto ainda não tem avaliações. Comprou? Depois de receber, avalie em Minha Conta → Meus pedidos.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="font-serif text-4xl text-brand-navy">
              {resumo.media.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <div>
              <Estrelas valor={resumo.media} tamanho="md" />
              <p className="mt-0.5 text-xs text-slate-500">
                {resumo.total} {resumo.total === 1 ? "avaliação" : "avaliações"}
              </p>
            </div>
          </div>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {resumo.avaliacoes.map((avaliacao) => (
              <li key={avaliacao.id} className="rounded-sm border border-slate-200 bg-white p-5">
                <Estrelas valor={avaliacao.nota} tamanho="sm" />
                {avaliacao.comentario && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {avaliacao.comentario}
                  </p>
                )}
                <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="font-medium text-brand-navy">{avaliacao.nomeExibicao}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <BadgeCheck aria-hidden className="h-3.5 w-3.5" />
                    Compra verificada
                  </span>
                  <span aria-hidden>·</span>
                  <span>{formatarData(avaliacao.criadaEm)}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
