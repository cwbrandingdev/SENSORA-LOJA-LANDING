import { StatusPedido } from "@/lib/types/loja";

const LABELS: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "Pendente",
  [StatusPedido.PAGO]: "Pago",
  [StatusPedido.CANCELADO]: "Cancelado",
};

const CLASSES: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "bg-amber-50 text-amber-700",
  [StatusPedido.PAGO]: "bg-emerald-50 text-emerald-700",
  [StatusPedido.CANCELADO]: "bg-red-50 text-red-700",
};

export default function StatusPedidoBadge({ status }: { status: StatusPedido }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${CLASSES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
