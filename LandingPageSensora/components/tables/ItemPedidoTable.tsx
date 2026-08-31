// Portado de frontend/components/tables/ItemPedidoTable.js — mesmo
// comportamento e colunas.
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
        message="Adicione um item para começar a montar o pedido."
      />
    );
  }

  function nomeProduto(produtoId: number): string {
    const produto = produtos?.find((p) => p.id === produtoId);
    return produto ? produto.nome : `Produto #${produtoId}`;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-brand-navy text-white">
            <th className="px-4 py-2 font-medium">Produto</th>
            <th className="px-4 py-2 font-medium">Quantidade</th>
            <th className="px-4 py-2 font-medium">Preço unitário</th>
            <th className="px-4 py-2 font-medium">Subtotal</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50">
              <td className="px-4 py-2">{nomeProduto(item.produtoId)}</td>
              <td className="px-4 py-2">{item.quantidade}</td>
              <td className="px-4 py-2">{item.precoUnitario}</td>
              <td className="px-4 py-2">{item.subtotal}</td>
              <td className="px-4 py-2">
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
