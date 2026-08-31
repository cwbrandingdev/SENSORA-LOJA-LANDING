import { Eye, Pencil, Trash2, Receipt } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { formatBRL } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import IconActionButton from "@/components/ui/IconActionButton";
import Button from "@/components/ui/Button";

const STATUS_LABEL = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

const STATUS_VARIANT = {
  PENDENTE: "warning",
  PAGO: "success",
  CANCELADO: "danger",
};

export function PedidoStatusBadge({ status }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function PedidoTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="ml-auto h-4 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

export default function PedidoTable({ pedidos, onEdit, onRemove, onCreate }) {
  if (!pedidos || pedidos.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Nenhum pedido cadastrado"
        description="Assim que houver pedidos, eles aparecerão aqui."
        action={
          onCreate && (
            <Button variant="primary" onClick={onCreate}>
              Novo pedido
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
              <th className="px-4 py-3 font-medium">Número</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((pedido) => (
              <tr
                key={pedido.id}
                className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                  {pedido.numero}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {new Date(pedido.data).toLocaleDateString("pt-BR")}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <PedidoStatusBadge status={pedido.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {formatBRL(pedido.total)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <IconActionButton
                      icon={Eye}
                      label={`Ver itens do pedido ${pedido.numero}`}
                      href={`${ROUTES.PEDIDOS}/${pedido.id}`}
                    />
                    <IconActionButton
                      icon={Pencil}
                      label={`Editar pedido ${pedido.numero}`}
                      onClick={() => onEdit(pedido)}
                    />
                    <IconActionButton
                      icon={Trash2}
                      label={`Remover pedido ${pedido.numero}`}
                      variant="danger"
                      onClick={() => onRemove(pedido)}
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
