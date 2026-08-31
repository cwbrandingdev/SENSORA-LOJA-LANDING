"use client";

import Link from "next/link";
import type { ReactNode } from "react";

const VARIANTS = {
  primary: "bg-brand-orange text-white hover:bg-brand-orange-light hover:shadow-brand-orange/25",
  outline: "border border-white text-white hover:bg-white hover:text-brand-navy hover:shadow-black/10",
  navy: "bg-brand-navy text-white hover:bg-brand-navy-light hover:shadow-brand-navy/30",
} as const;

const BASE_CLASS =
  "inline-flex items-center justify-center rounded-full px-8 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none";

type ButtonBaseProps = {
  variant?: keyof typeof VARIANTS;
  className?: string;
  children: ReactNode;
};

// CTA de navegação (comportamento original, único até aqui) — sempre que
// `href` é passado, este continua sendo um <Link>, byte a byte igual ao
// markup anterior.
type ButtonLinkProps = ButtonBaseProps & {
  href: string;
  onClick?: never;
  type?: never;
  disabled?: never;
};

// CTA de ação (ex.: "Adicionar ao carrinho") — sem `href`, vira um
// <button> de verdade, mesma linguagem visual, com onClick/type/disabled.
type ButtonActionProps = ButtonBaseProps & {
  href?: undefined;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
};

type ButtonProps = ButtonLinkProps | ButtonActionProps;

export default function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = `${BASE_CLASS} ${VARIANTS[variant]} ${className}`;

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes}>
        {children}
      </Link>
    );
  }

  const { onClick, type = "button", disabled } = props as ButtonActionProps;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
