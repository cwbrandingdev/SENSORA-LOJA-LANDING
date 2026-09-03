// Portado de frontend/components/tables/PedidoTable.js — mesmo
// comportamento e colunas. O link "Ver itens" usa ROUTES.PEDIDOS, já
// portado em lib/routes.ts com o mesmo caminho (não movido ainda).
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import FormButton from "@/components/ui/FormButton";
import EmptyState from "@/components/ui/EmptyState";
import type { Pedido } from "@/lib/types/loja";

type PedidoTableProps = {
  pedidos: Pedido[];
  onEdit: (pedido: Pedido) => void;
  onRemove: (pedido: Pedido) => void;
};

export default function PedidoTable({ pedidos, onEdit, onRemove }: PedidoTableProps) {
  if (!pedidos || pedidos.length === 0) {
    return (
      <EmptyState
        compact
        eyebrow="Pedidos"
        title="Nenhum pedido cadastrado"
        message="Ainda não há pedidos registrados."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-brand-navy text-white">
            <th className="px-4 py-2 font-medium">Número</th>
            <th className="px-4 py-2 font-medium">Data</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Total</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((pedido) => (
            <tr key={pedido.id} className="border-t border-slate-200 hover:bg-slate-50">
              <td className="px-4 py-2">{pedido.numero}</td>
              <td className="px-4 py-2">
                {/* Achado da investigação (Editar pedido PENDENTE, Etapa
                    6.6) — `pedido.data` é meia-noite UTC; sem `timeZone:
                    "UTC"` aqui, toLocaleDateString converte para o fuso
                    local (ex.: America/Sao_Paulo, UTC-3) e exibe o dia
                    anterior, divergindo do valor real salvo (e do que o
                    próprio formulário de edição mostra, que lê a string ISO
                    diretamente sem passar por Date). */}
                {new Date(pedido.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
              </td>
              <td className="px-4 py-2">{pedido.status}</td>
              <td className="px-4 py-2">{pedido.total}</td>
              <td className="px-4 py-2">
                <div className="flex gap-2">
                  <Link
                    href={`${ROUTES.PEDIDOS}/${pedido.id}`}
                    className="inline-flex items-center justify-center rounded-md border border-brand-navy px-3 py-2 text-sm font-medium text-brand-navy hover:bg-slate-50"
                  >
                    Ver itens
                  </Link>
                  <FormButton variant="secondary" onClick={() => onEdit(pedido)}>
                    Editar
                  </FormButton>
                  <FormButton variant="danger" onClick={() => onRemove(pedido)}>
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
