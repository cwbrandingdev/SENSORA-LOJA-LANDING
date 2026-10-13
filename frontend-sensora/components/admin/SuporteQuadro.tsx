// Quadro da aba Suporte (/workspace-x/suporte): uma coluna por status e,
// dentro de cada coluna, as solicitações da página agrupadas por dia numa
// linha do tempo. Os dados, filtros e paginação ficam na página; aqui é só
// a apresentação.
import type { ReactNode } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import {
  ROTULOS_CATEGORIA_SUPORTE,
  ROTULOS_STATUS_SUPORTE,
  type SolicitacaoSuporteResumo,
  type StatusSolicitacaoSuporte,
} from "@/lib/types/loja";
import { cn } from "@/lib/utils";

type SuporteQuadroProps = {
  itens: SolicitacaoSuporteResumo[];
  // Carregando, erro ou vazio (null quando há itens para mostrar).
  estado: ReactNode | null;
  paginacao: ReactNode;
  status: string;
  categoria: string;
  onStatus: (valor: string) => void;
  onCategoria: (valor: string) => void;
};

const STATUS: StatusSolicitacaoSuporte[] = ["ABERTA", "EM_ATENDIMENTO", "RESOLVIDA"];

const COR_COLUNA: Record<StatusSolicitacaoSuporte, string> = {
  ABERTA: "bg-amber-500",
  EM_ATENDIMENTO: "bg-sky-500",
  RESOLVIDA: "bg-emerald-500",
};

const PONTO_STATUS: Record<StatusSolicitacaoSuporte, string> = {
  ABERTA: "bg-amber-500 ring-amber-100",
  EM_ATENDIMENTO: "bg-sky-500 ring-sky-100",
  RESOLVIDA: "bg-emerald-500 ring-emerald-100",
};

// Dia em São Paulo ("AAAA-MM-DD") e o rótulo do grupo (Hoje, Ontem ou data).
function diaSp(data: Date): string {
  return data.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function rotuloDia(dia: string): string {
  if (dia === diaSp(new Date())) return "Hoje";
  if (dia === diaSp(new Date(Date.now() - 24 * 60 * 60 * 1000))) return "Ontem";
  const [ano, mes, d] = dia.split("-");
  return `${d}/${mes}/${ano}`;
}

function agruparPorDia(itens: SolicitacaoSuporteResumo[]) {
  const grupos: { dia: string; itens: SolicitacaoSuporteResumo[] }[] = [];
  for (const s of itens) {
    const dia = diaSp(new Date(s.criadaEm));
    const grupo = grupos.find((g) => g.dia === dia);
    if (grupo) grupo.itens.push(s);
    else grupos.push({ dia, itens: [s] });
  }
  return grupos;
}

const hora = (data: string) =>
  new Date(data).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function SuporteQuadro({
  itens,
  estado,
  paginacao,
  status,
  categoria,
  onStatus,
  onCategoria,
}: SuporteQuadroProps) {
  // Com um status filtrado, o quadro mostra só a coluna dele.
  const colunas = status ? STATUS.filter((s) => s === status) : STATUS;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
          Categoria
          <select
            value={categoria}
            onChange={(event) => onCategoria(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          >
            <option value="">Todas</option>
            {Object.entries(ROTULOS_CATEGORIA_SUPORTE).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        {status && (
          <button
            type="button"
            onClick={() => onStatus("")}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
          >
            Mostrar todas as colunas
          </button>
        )}
      </div>

      {estado ?? (
        <div className={cn("grid items-start gap-4", colunas.length === 3 ? "lg:grid-cols-3" : "")}>
          {colunas.map((coluna) => {
            const daColuna = itens.filter((s) => s.status === coluna);
            return (
              <section
                key={coluna}
                aria-label={ROTULOS_STATUS_SUPORTE[coluna]}
                className="flex flex-col gap-4 rounded-xl bg-slate-100/70 p-3"
              >
                <header className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => onStatus(coluna)}
                    className="flex items-center gap-2 text-sm font-semibold text-brand-navy hover:underline"
                  >
                    <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", COR_COLUNA[coluna])} />
                    {ROTULOS_STATUS_SUPORTE[coluna]}
                  </button>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {daColuna.length}
                  </span>
                </header>

                {daColuna.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                    Nada por aqui.
                  </p>
                ) : (
                  agruparPorDia(daColuna).map((grupo) => (
                    <div key={grupo.dia}>
                      <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {rotuloDia(grupo.dia)}
                      </h3>
                      <ol className="ml-2 border-l-2 border-slate-200">
                        {grupo.itens.map((s) => (
                          <li key={s.id} className="relative pb-3 pl-5 last:pb-0">
                            <span
                              aria-hidden
                              className={cn(
                                "absolute -left-[7px] top-3.5 h-3 w-3 rounded-full ring-4",
                                PONTO_STATUS[s.status],
                              )}
                            />
                            <Link
                              href={`${ROUTES.SUPORTE}/${s.id}`}
                              className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-medium uppercase tracking-wide text-slate-400">
                                  {ROTULOS_CATEGORIA_SUPORTE[s.categoria] ?? s.categoria}
                                </span>
                                <span className="shrink-0 font-semibold text-slate-400">{hora(s.criadaEm)}</span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm font-semibold text-brand-navy">{s.assunto}</p>
                              <p className="mt-2 truncate text-xs text-slate-500">{s.nome}</p>
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}

      {!estado && paginacao}
    </div>
  );
}
