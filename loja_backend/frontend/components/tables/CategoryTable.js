import { Pencil, Trash2, Tag } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import IconActionButton from "@/components/ui/IconActionButton";
import Button from "@/components/ui/Button";

export function CategoryTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-3 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-56" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function CategoryTable({ categorias, onEdit, onRemove, onCreate }) {
  if (!categorias || categorias.length === 0) {
    return (
      <EmptyState
        icon={Tag}
        title="Nenhuma categoria cadastrada"
        description="Assim que você criar a primeira categoria, ela aparecerá aqui."
        action={
          onCreate && (
            <Button variant="primary" onClick={onCreate}>
              Nova categoria
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((categoria) => (
              <tr
                key={categoria.id}
                className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{categoria.nome}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {categoria.descricao || (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <IconActionButton
                      icon={Pencil}
                      label={`Editar ${categoria.nome}`}
                      onClick={() => onEdit(categoria)}
                    />
                    <IconActionButton
                      icon={Trash2}
                      label={`Remover ${categoria.nome}`}
                      variant="danger"
                      onClick={() => onRemove(categoria)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
