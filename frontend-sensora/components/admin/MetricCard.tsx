// Etapa 6.6 (Dashboard Admin) — card de métrica genérico, reaproveitado
// pelos 4 cards de "Visão geral" (Faturamento/Pedidos/Produtos/Categorias,
// ver app/workspace-x/page.tsx). Criado no Lote 1 só com skeleton (nenhuma API
// conectada); no Lote 2 os usos passaram a alternar `loading`/`erro`/`valor`
// conforme o resultado real de GET /pedidos, /produtos e /categorias — o
// componente em si não mudou, só ganhou uso de verdade das props que já
// existiam.
import type { ComponentType } from "react";
import Skeleton from "@/components/ui/Skeleton";

type MetricCardProps = {
  titulo: string;
  valor?: string;
  descricao?: string;
  loading?: boolean;
  erro?: string;
  /** Opcional — undefined preserva os 4 usos existentes (Dashboard) sem
   *  nenhuma mudança visual. Mesmo raciocínio de EmptyState.tsx: ícone
   *  decorativo (lucide-react), sempre aria-hidden. */
  icon?: ComponentType<{ className?: string }>;
};

export default function MetricCard({
  titulo,
  valor,
  descricao,
  loading = false,
  erro,
  icon: Icon,
}: MetricCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {titulo}
        </p>
        {Icon && (
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange"
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-9 w-24" />
      ) : erro ? (
        <p className="text-sm text-red-600">{erro}</p>
      ) : (
        <p className="text-3xl font-light text-brand-navy">{valor ?? "—"}</p>
      )}

      {!loading && !erro && descricao && (
        <p className="text-sm text-slate-500">{descricao}</p>
      )}
    </div>
  );
}
