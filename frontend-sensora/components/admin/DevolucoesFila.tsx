"use client";

// Fila de devoluções do Admin (escolhida na comparação de designs, "Prazo +
// Caixa de entrada"): abas Precisa de ação / Em andamento / Finalizadas e
// linhas clicáveis com faixa na cor do status e há quantos dias foi pedida,
// em laranja quando passou de 3 dias sem análise. Carregar e filtrar
// continuam na página.
import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { ROUTES } from "@/lib/routes";
import {
  ROTULOS_STATUS_DEVOLUCAO,
  TOM_STATUS_DEVOLUCAO,
  type DevolucaoResumoAdmin,
} from "@/lib/types/loja";

const BARRA_TOM = {
  neutral: "bg-slate-300",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
};

function tomDe(devolucao: DevolucaoResumoAdmin) {
  return TOM_STATUS_DEVOLUCAO[devolucao.status] ?? "neutral";
}

function StatusBadge({ devolucao }: { devolucao: DevolucaoResumoAdmin }) {
  return (
    <Badge tone={tomDe(devolucao)}>
      {ROTULOS_STATUS_DEVOLUCAO[devolucao.status] ?? devolucao.status}
    </Badge>
  );
}

function linkDe(devolucao: DevolucaoResumoAdmin) {
  return `${ROUTES.DEVOLUCOES}/${devolucao.id}`;
}

function diasDesde(data: string) {
  return Math.floor((Date.now() - new Date(data).getTime()) / 86_400_000);
}

function textoDias(dias: number) {
  if (dias === 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

// C · Linhas grandes e clicáveis com uma faixa na cor do status à
// esquerda; mostra há quantos dias foi pedida e destaca em laranja as que
// ainda esperam análise há mais de 3 dias.
function LinhaPrazo({ devolucao }: { devolucao: DevolucaoResumoAdmin }) {
  const dias = diasDesde(devolucao.solicitadaEm);
  const atrasada = !devolucao.analisadaEm && dias > 3;
  return (
    <Link
      href={linkDe(devolucao)}
      className="group flex items-stretch border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50"
    >
      <span className={`w-1 shrink-0 ${BARRA_TOM[tomDe(devolucao)]}`} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-800">
            {devolucao.clienteNome ?? "—"}
            <span className="ml-2 text-sm font-normal text-slate-400">#{devolucao.id}</span>
          </p>
          <p className="truncate text-sm text-slate-500">
            Pedido {devolucao.pedidoNumero} · {devolucao.quantidadeItens} itens ·{" "}
            {devolucao.quantidadeFotos} fotos
          </p>
        </div>
        <StatusBadge devolucao={devolucao} />
        <span
          className={`w-24 text-sm sm:text-right ${atrasada ? "font-semibold text-brand-orange" : "text-slate-500"}`}
        >
          {textoDias(dias)}
        </span>
      </div>
      <span className="flex items-center pr-4 text-slate-300 transition-colors group-hover:text-brand-navy">
        <ChevronRight className="h-5 w-5" aria-hidden />
      </span>
    </Link>
  );
}

const ABAS = [
  { id: "acao", titulo: "Precisa de ação", status: ["SOLICITADA", "EM_ANALISE", "RECEBIDA", "EM_CONFERENCIA"] },
  { id: "andamento", titulo: "Em andamento", status: ["APROVADA", "AGUARDANDO_ENVIO", "ENVIADA"] },
  { id: "finalizadas", titulo: "Finalizadas", status: ["CONCLUIDA", "RECUSADA", "CANCELADA"] },
];

// Na aba "Precisa de ação", as mais antigas vêm primeiro.
export default function DevolucoesFila({ devolucoes }: { devolucoes: DevolucaoResumoAdmin[] }) {
  const [aba, setAba] = useState(ABAS[0].id);
  const lista = devolucoes.filter((d) => ABAS.find((a) => a.id === aba)?.status.includes(d.status));
  if (aba === "acao") lista.sort((a, b) => a.solicitadaEm.localeCompare(b.solicitadaEm));
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex overflow-x-auto border-b border-slate-200">
        {ABAS.map((a) => {
          const total = devolucoes.filter((d) => a.status.includes(d.status)).length;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                aba === a.id
                  ? "border-brand-orange text-brand-navy"
                  : "border-transparent text-slate-500 hover:text-brand-navy"
              }`}
            >
              {a.titulo}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  aba === a.id ? "bg-brand-orange text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {total}
              </span>
            </button>
          );
        })}
      </div>
      {lista.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">Nada por aqui.</p>
      ) : (
        lista.map((devolucao) => <LinhaPrazo key={devolucao.id} devolucao={devolucao} />)
      )}
    </div>
  );
}
