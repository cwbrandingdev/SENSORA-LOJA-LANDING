"use client";

// Vistoria de Alertas Operacionais (Admin) — painel reutilizável, montado
// hoje só em app/workspace-x/page.tsx (Dashboard), mas sem nenhuma
// dependência dessa página específica: só chama GET /alertas
// (services/alertas.ts) e reaproveita os componentes de UI já existentes
// (Badge para severidade, EmptyState para "sem alertas", InlineErrorState
// para erro com retry, Skeleton para loading) — nenhum estilo/cor novo é
// criado aqui. Cada item já vem do backend com `link` para a tela que
// resolve o problema (Produtos/Pedidos/Integrações) — sempre uma rota
// BASE, nunca query string (nenhuma dessas páginas lê searchParams hoje).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/InlineErrorState";
import Skeleton from "@/components/ui/Skeleton";
import { getErrorMessage } from "@/lib/errors";
import { buscarAlertas } from "@/services/alertas";
import type { Alerta, AlertaSeveridade } from "@/lib/types/loja";

// Só os dois tons que os 4 alertas desta etapa usam (ver
// backend/src/alertas/entities/alerta.entity.ts) — Badge já suporta os
// demais tons (neutral/success/info), nenhum é necessário aqui.
const TONE_POR_SEVERIDADE: Record<AlertaSeveridade, BadgeTone> = {
  warning: "warning",
  danger: "danger",
};

export default function AlertasPanel() {
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const dados = await buscarAlertas();
      setAlertas(dados);
    } catch (err) {
      setErro(getErrorMessage(err, "Não foi possível carregar os alertas."));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const carregando = alertas === null && !erro;

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

      {erro && <InlineErrorState message={erro} onRetry={carregar} />}

      {!carregando && !erro && alertas && alertas.length === 0 && (
        <EmptyState
          eyebrow="Tudo certo"
          title="Nenhum alerta no momento"
          message="Estoque, reembolsos, envios e a conexão de frete estão normais."
          compact
        />
      )}

      {!carregando && !erro && alertas && alertas.length > 0 && (
        <ul className="flex flex-col gap-3">
          {alertas.map((alerta) => (
            <li key={alerta.tipo}>
              <Link
                href={alerta.link}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-orange/40 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <Badge tone={TONE_POR_SEVERIDADE[alerta.severidade]}>
                    {alerta.quantidade}
                  </Badge>
                  <span className="text-sm font-medium text-brand-navy">{alerta.titulo}</span>
                </div>
                <span className="shrink-0 text-xs font-medium text-slate-400">Ver</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
