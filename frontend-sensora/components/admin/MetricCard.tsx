// Etapa 6.6 (Dashboard Admin) — card de métrica genérico, reaproveitado
// pelos 4 cards de "Visão geral" (Faturamento/Pedidos/Produtos/Categorias,
// ver app/admin/page.tsx). Criado no Lote 1 só com skeleton (nenhuma API
// conectada); no Lote 2 os usos passaram a alternar `loading`/`erro`/`valor`
// conforme o resultado real de GET /pedidos, /produtos e /categorias — o
// componente em si não mudou, só ganhou uso de verdade das props que já
// existiam.
import Skeleton from "@/components/ui/Skeleton";

type MetricCardProps = {
  titulo: string;
  valor?: string;
  descricao?: string;
  loading?: boolean;
  erro?: string;
};

export default function MetricCard({
  titulo,
  valor,
  descricao,
  loading = false,
  erro,
}: MetricCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {titulo}
      </p>

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
