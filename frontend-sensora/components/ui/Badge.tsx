// Padrão visual único de "status" para o Admin (tabelas de Pedidos/
// Produtos/Usuários) — generaliza o pill+ponto já usado em
// components/conta/StatusPedidoBadge.tsx, para não duplicar a mesma
// receita visual (rounded-full + ponto colorido) toda vez que uma tabela
// precisa mostrar um status. Nunca decide QUAL cor cada status usa — isso
// fica no chamador (ver PedidoTable.tsx/ProductTable.tsx), este componente
// só sabe pintar um "tone" já escolhido. Nenhum status novo é criado aqui.
export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-sky-50 text-sky-700",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
};

type BadgeProps = {
  tone?: BadgeTone;
  children: React.ReactNode;
  /** Ponto colorido antes do texto — desligável para rótulos curtos onde o
   *  ponto adicionaria ruído sem ajudar (ex.: "Sim"/"Não"). */
  dot?: boolean;
};

export default function Badge({ tone = "neutral", children, dot = true }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${TONE_CLASSES[tone]}`}
    >
      {dot && <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[tone]}`} />}
      {children}
    </span>
  );
}
