const VARIANTS = {
  primary: "bg-brand-navy text-white hover:bg-brand-navy-light",
  secondary:
    "bg-white text-brand-navy border border-brand-navy hover:bg-slate-50",
  danger: "bg-brand-orange text-white hover:bg-brand-orange-light",
  ghost:
    "bg-transparent text-slate-600 border border-slate-300 hover:bg-slate-100",
};

// Anel de foco único para todas as variantes: offset branco (2px) + anel
// navy sólido. Funciona nos dois fundos usados pelos botões — sobre cards
// brancos (Dialog, formulários) o anel navy é o sinal visível; sobre a
// Sidebar navy (variante danger do botão "Sair") é o gap branco do offset
// que aparece — cada contexto sempre tem um sinal nítido.
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-navy";

export default function Button({
  variant = "primary",
  type = "button",
  className = "",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
