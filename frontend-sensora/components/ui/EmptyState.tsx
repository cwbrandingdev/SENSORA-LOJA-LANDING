type EmptyStateProps = {
  title: string;
  message: string;
  /** Default "Em breve" preserva todos os usos existentes sem alteração. */
  eyebrow?: string;
  /** Padding vertical reduzido (py-8 em vez de py-20) — para contextos
   *  densos como uma tabela administrativa vazia, onde o py-20 pensado para
   *  uma seção pública inteira fica desproporcional. Default false preserva
   *  todos os usos existentes sem alteração (Task 21). */
  compact?: boolean;
};

export default function EmptyState({
  title,
  message,
  eyebrow = "Em breve",
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`mx-auto flex max-w-xl flex-col items-center gap-4 text-center ${compact ? "py-8" : "py-20"}`}
    >
      <span className="h-px w-12 bg-brand-orange" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">{eyebrow}</p>
      <h2 className="text-2xl font-light text-brand-navy sm:text-3xl">{title}</h2>
      <p className="text-base leading-relaxed text-slate-600">{message}</p>
    </div>
  );
}
