// Portado de frontend/components/tables/ItemPedidoTable.js — mesmo
// comportamento e colunas.
//
// Refinamento visual (Admin) — cabeçalho claro, mesmo padrão de
// PedidoTable.tsx/ProductTable.tsx. Nenhuma coluna/ação removida.
import { ClipboardList } from "lucide-react";
import FormButton from "@/components/ui/FormButton";
import EmptyState from "@/components/ui/EmptyState";
import type { ItemPedido, Produto } from "@/lib/types/loja";

type ItemPedidoTableProps = {
  itens: ItemPedido[];
  produtos?: Produto[];
  onEdit: (item: ItemPedido) => void;
  onRemove: (item: ItemPedido) => void;
};

export default function ItemPedidoTable({ itens, produtos, onEdit, onRemove }: ItemPedidoTableProps) {
  if (!itens || itens.length === 0) {
    return (
      <EmptyState
        compact
        eyebrow="Itens do pedido"
        title="Nenhum item neste pedido"
        message="Este pedido ainda não tem itens."
        icon={ClipboardList}
      />
    );
  }

  function nomeProduto(produtoId: number): string {
    const produto = produtos?.find((p) => p.id === produtoId);
    return produto ? produto.nome : `Produto #${produtoId}`;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Produto
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Quantidade
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Preço unitário
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Subtotal
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {itens.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-slate-50/80">
              <td className="px-4 py-3 font-medium text-slate-900">{nomeProduto(item.produtoId)}</td>
              <td className="px-4 py-3 text-slate-600">{item.quantidade}</td>
              <td className="px-4 py-3 text-slate-600">{item.precoUnitario}</td>
              <td className="px-4 py-3 text-slate-600">{item.subtotal}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <FormButton variant="secondary" onClick={() => onEdit(item)}>
                    Editar
                  </FormButton>
                  <FormButton variant="danger" onClick={() => onRemove(item)}>
                    Remover
                  </FormButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
