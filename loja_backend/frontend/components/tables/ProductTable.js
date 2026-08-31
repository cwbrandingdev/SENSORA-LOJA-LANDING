import { Pencil, Trash2, Package } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import IconActionButton from "@/components/ui/IconActionButton";
import Button from "@/components/ui/Button";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatPreco(preco) {
  const value = Number(preco);
  return Number.isFinite(value) ? currencyFormatter.format(value) : preco;
}

function EstoqueBadge({ quantidade }) {
  if (quantidade <= 0) {
    return <Badge variant="danger">Sem estoque</Badge>;
  }
  if (quantidade <= 5) {
    return <Badge variant="warning">Estoque baixo</Badge>;
  }
  return <Badge variant="success">Em estoque</Badge>;
}

export function ProductTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function ProductTable({ produtos, onEdit, onRemove, onCreate }) {
  if (!produtos || produtos.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Nenhum produto cadastrado"
        description="Assim que você criar o primeiro produto, ele aparecerá aqui."
        action={
          onCreate && (
            <Button variant="primary" onClick={onCreate}>
              Novo produto
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
              <th className="px-4 py-3 font-medium">Produto</th>
              <th className="px-4 py-3 font-medium">Preço</th>
              <th className="px-4 py-3 font-medium">Estoque</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((produto) => (
              <tr
                key={produto.id}
                className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{produto.nome}</p>
                  {produto.descricao && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {produto.descricao}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {formatPreco(produto.preco)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-2">
                    <EstoqueBadge quantidade={produto.quantidade} />
                    <span className="text-xs text-slate-400">
                      ({produto.quantidade})
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <IconActionButton
                      icon={Pencil}
                      label={`Editar ${produto.nome}`}
                      onClick={() => onEdit(produto)}
                    />
                    <IconActionButton
                      icon={Trash2}
                      label={`Remover ${produto.nome}`}
                      variant="danger"
                      onClick={() => onRemove(produto)}
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
