// Portado de frontend/components/ui/Button.js — botão de AÇÃO (formulários/
// tabelas do admin), não de navegação. Renomeado para FormButton porque a
// Landing já tem um Button.tsx com contrato incompatível (wrapper de
// next/link para CTAs, sem type/onClick/disabled) — ver auditoria de fusão,
// item 5. Nenhum dos dois foi alterado; convivem sob nomes distintos.
import type { ButtonHTMLAttributes, ReactNode } from "react";

const VARIANTS = {
  primary: "bg-brand-navy text-white hover:bg-brand-navy-light",
  secondary: "bg-white text-brand-navy border border-brand-navy hover:bg-slate-50",
  danger: "bg-brand-orange text-white hover:bg-brand-orange-light",
  ghost: "bg-transparent text-slate-600 border border-slate-300 hover:bg-slate-100",
} as const;

type FormButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
};

export default function FormButton({
  variant = "primary",
  type = "button",
  className = "",
  children,
  ...props
}: FormButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
