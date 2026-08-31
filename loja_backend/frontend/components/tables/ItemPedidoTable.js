import { Pencil, Trash2, PackageSearch } from "lucide-react";
import { formatBRL } from "@/lib/format";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import IconActionButton from "@/components/ui/IconActionButton";
import Button from "@/components/ui/Button";

export function ItemPedidoTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="ml-auto h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-10" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function ItemPedidoTable({
  itens,
  produtos,
  onEdit,
  onRemove,
  onCreate,
}) {
  function nomeProduto(produtoId) {
    const produto = produtos?.find((p) => p.id === produtoId);
    return produto ? produto.nome : `Produto #${produtoId}`;
  }

  if (!itens || itens.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Nenhum item neste pedido"
        description="Adicione produtos para compor este pedido."
        action={
          onCreate && (
            <Button variant="primary" onClick={onCreate}>
              Adicionar item
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
              <th className="px-4 py-3 font-medium">Quantidade</th>
              <th className="px-4 py-3 font-medium">Preço unitário</th>
              <th className="px-4 py-3 font-medium">Subtotal</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr
                key={item.id}
                className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  {nomeProduto(item.produtoId)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {item.quantidade}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formatBRL(item.precoUnitario)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                  {formatBRL(item.subtotal)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <IconActionButton
                      icon={Pencil}
                      label={`Editar item ${nomeProduto(item.produtoId)}`}
                      onClick={() => onEdit(item)}
                    />
                    <IconActionButton
                      icon={Trash2}
                      label={`Remover item ${nomeProduto(item.produtoId)}`}
                      variant="danger"
                      onClick={() => onRemove(item)}
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
