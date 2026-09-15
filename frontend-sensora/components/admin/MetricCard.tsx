// Etapa 6.6 (Dashboard Admin) — card de métrica genérico, reaproveitado
// pelos 4 cards de "Visão geral" (Faturamento/Pedidos/Produtos/Categorias,
// ver app/workspace-x/page.tsx). Criado no Lote 1 só com skeleton (nenhuma API
// conectada); no Lote 2 os usos passaram a alternar `loading`/`erro`/`valor`
// conforme o resultado real de GET /pedidos, /produtos e /categorias — o
// componente em si não mudou, só ganhou uso de verdade das props que já
// existiam.
//
// Melhoria visual (revisão de UX) — duas props novas, ambas opcionais e sem
// nenhum efeito em dados/lógica: `destaque` dá ao card de Faturamento o
// tratamento navy de maior peso visual (usado só nele); `iconTone` varia o
// tratamento do ícone dos 3 cards secundários para evitar quatro círculos
// laranja idênticos. Nenhum uso existente muda de aparência sem passar as
// props explicitamente.
import type { ComponentType } from "react";
import Skeleton from "@/components/ui/Skeleton";

type IconTone = "orange" | "orange-outline" | "navy" | "navy-outline";

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
  /** Card de destaque (Faturamento): fundo navy, valor com peso visual maior.
   *  Default false preserva o tratamento claro dos demais cards. */
  destaque?: boolean;
  /** Variação discreta do círculo/quadrado do ícone nos cards não-destaque.
   *  Ignorado quando `destaque` é true (usa o tratamento próprio dele). */
  iconTone?: IconTone;
};

const ICON_TONE_CLASSES: Record<IconTone, string> = {
  orange: "rounded-full bg-brand-orange/10 text-brand-orange",
  "orange-outline": "rounded-xl border border-brand-orange/30 text-brand-orange",
  navy: "rounded-xl bg-brand-navy/8 text-brand-navy",
  "navy-outline": "rounded-full border border-brand-navy/25 text-brand-navy",
};

export default function MetricCard({
  titulo,
  valor,
  descricao,
  loading = false,
  erro,
  icon: Icon,
  destaque = false,
  iconTone = "orange",
}: MetricCardProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl p-6 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        destaque
          ? "bg-gradient-to-br from-brand-navy to-brand-navy-light text-white"
          : "border border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <p
          className={`text-xs font-semibold uppercase tracking-[0.14em] ${
            destaque ? "text-white/60" : "text-slate-500"
          }`}
        >
          {titulo}
        </p>
        {Icon && (
          <span
            aria-hidden
            className={`flex h-9 w-9 shrink-0 items-center justify-center ${
              destaque ? "rounded-xl bg-brand-orange text-white" : ICON_TONE_CLASSES[iconTone]
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className={destaque ? "h-11 w-32" : "h-9 w-24"} />
      ) : erro ? (
        <p className={`text-sm ${destaque ? "text-red-300" : "text-red-600"}`}>{erro}</p>
      ) : (
        <p
          className={`tabular-nums ${
            destaque
              ? "text-4xl font-semibold sm:text-5xl"
              : "text-3xl font-light text-brand-navy"
          }`}
        >
          {valor ?? "—"}
        </p>
      )}

      {!loading && !erro && descricao && (
        <p className={`text-sm ${destaque ? "text-white/70" : "text-slate-500"}`}>{descricao}</p>
      )}
    </div>
  );
}
