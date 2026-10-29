"use client";

// Vistoria de Alertas Operacionais (Admin) — painel reutilizável, montado
// hoje só em app/workspace-x/page.tsx (Dashboard), mas sem nenhuma
// dependência dessa página específica: usa o mesmo GET /alertas do
// AlertasAdminContext (sininho/sidebar) e reaproveita os componentes de UI
// já existentes (Badge, EmptyState, InlineErrorState, Skeleton).
import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/InlineErrorState";
import Skeleton from "@/components/ui/Skeleton";
import { useAlertasAdmin } from "@/context/AlertasAdminContext";
import { getErrorMessage } from "@/lib/errors";
import type { AlertaSeveridade, AlertaTipo } from "@/lib/types/loja";

// Só os dois tons que os 4 alertas desta etapa usam (ver
// backend/src/alertas/entities/alerta.entity.ts) — Badge já suporta os
// demais tons (neutral/success/info), nenhum é necessário aqui.
const TONE_POR_SEVERIDADE: Record<AlertaSeveridade, BadgeTone> = {
  info: "info",
  warning: "warning",
  danger: "danger",
};

export default function AlertasPanel() {
  const { alertas, atualizadoEm, erroCarregar, recarregar, excluirAlerta } =
    useAlertasAdmin();
  const [excluindo, setExcluindo] = useState<AlertaTipo | null>(null);

  const carregando = atualizadoEm === null && !erroCarregar;

  async function aoExcluir(tipo: AlertaTipo) {
    setExcluindo(tipo);
    try {
      await excluirAlerta(tipo);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível excluir o alerta."));
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
        Alertas
      </h3>

      {carregando && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {erroCarregar && (
        <InlineErrorState message={erroCarregar} onRetry={recarregar} />
      )}

      {!carregando && !erroCarregar && alertas.length === 0 && (
        <EmptyState
          eyebrow="Tudo certo"
          title="Nenhum alerta no momento"
          message="Estoque, reembolsos, envios e a conexão de frete estão normais."
          compact
        />
      )}

      {!carregando && !erroCarregar && alertas.length > 0 && (
        <ul className="flex flex-col gap-3">
          {alertas.map((alerta) => (
            <li
              key={alerta.tipo}
              className="flex items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-colors hover:border-brand-orange/40"
            >
              <Link
                href={alerta.link}
                className="flex min-w-0 flex-1 items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <Badge tone={TONE_POR_SEVERIDADE[alerta.severidade]}>
                    {alerta.quantidade}
                  </Badge>
                  <span className="text-sm font-medium text-brand-navy">{alerta.titulo}</span>
                </div>
                <span className="shrink-0 text-xs font-medium text-slate-400">Ver</span>
              </Link>
              <button
                type="button"
                title="Excluir"
                aria-label={`Excluir alerta: ${alerta.titulo}`}
                disabled={excluindo === alerta.tipo}
                onClick={() => aoExcluir(alerta.tipo)}
                className="inline-flex w-12 shrink-0 items-center justify-center border-l border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
