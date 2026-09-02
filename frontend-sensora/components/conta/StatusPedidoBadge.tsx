import { StatusPedido } from "@/lib/types/loja";

// Etapa 5B.7 — REEMBOLSO_SOLICITADO/REEMBOLSADO usam cores próprias (sky/
// slate), nunca reaproveitando amber (PENDENTE) ou red (CANCELADO): são
// fluxos diferentes e a cor do badge não pode sugerir semelhança entre eles.
const LABELS: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "Pendente",
  [StatusPedido.PAGO]: "Pago",
  [StatusPedido.CANCELADO]: "Cancelado",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "Reembolso solicitado",
  [StatusPedido.REEMBOLSADO]: "Reembolsado",
};

const CLASSES: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "bg-amber-50 text-amber-700",
  [StatusPedido.PAGO]: "bg-emerald-50 text-emerald-700",
  [StatusPedido.CANCELADO]: "bg-red-50 text-red-700",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "bg-sky-50 text-sky-700",
  [StatusPedido.REEMBOLSADO]: "bg-slate-100 text-slate-600",
};

// Etapa 6.1 (Refinamento) — cor sólida do ponto (não dá pra usar `currentColor`
// direto: o texto já usa a variante clara -700/-600 da mesma família, um
// ponto na mesma cor do texto ficaria apagado demais ao lado do rótulo).
const DOT_CLASSES: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "bg-amber-500",
  [StatusPedido.PAGO]: "bg-emerald-500",
  [StatusPedido.CANCELADO]: "bg-red-500",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "bg-sky-500",
  [StatusPedido.REEMBOLSADO]: "bg-slate-400",
};

export default function StatusPedidoBadge({ status }: { status: StatusPedido }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${CLASSES[status]}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[status]}`} />
      {LABELS[status]}
    </span>
  );
}
