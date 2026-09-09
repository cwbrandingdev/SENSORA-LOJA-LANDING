// Substitui o placeholder "Carregando X..." em texto puro nas páginas de
// listagem do Admin (Pedidos/Produtos/Clientes/Usuários/Categorias) — mesmo
// componente Skeleton.tsx já usado em MetricCard, só organizado como linhas
// de tabela, reservando o espaço aproximado do conteúdo final (evita layout
// shift quando os dados chegam).
import Skeleton from "@/components/ui/Skeleton";

type TableSkeletonProps = {
  /** Linhas fantasma a desenhar — combine com a quantidade típica de itens
   *  da tela para o placeholder já "parecer" a tabela real. */
  rows?: number;
  columns?: number;
};

export default function TableSkeleton({ rows = 4, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, linha) => (
          <div key={linha} className="flex items-center gap-6 px-4 py-4">
            {Array.from({ length: columns }).map((__, coluna) => (
              <Skeleton
                key={coluna}
                className={`h-3.5 ${coluna === 0 ? "w-32" : "w-16"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
