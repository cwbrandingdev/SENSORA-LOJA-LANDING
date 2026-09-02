"use client";

// Etapa 6.1 (Refinamento — Minha Conta) — cabeçalho compartilhado das 6
// páginas da área. Antes, cada página duplicava o mesmo bloco
// eyebrow/h1/p (ver auditoria); agora fica num único lugar, com a
// navegação de volta (item 5/6 da etapa) embutida de propósito — nunca um
// link solto no fim da página. Inspirado no padrão "Back Button" do
// 21st.dev (seta que se desloca no hover, texto estável) e adaptado com o
// que o projeto já tem (lucide-react, Tailwind, `cn`) — nenhuma dependência
// nova.
//
// `BackLink` é exportado à parte porque /conta/pedidos/[id] tem um
// cabeçalho assimétrico (número do pedido + data + badge, não
// eyebrow/h1/p) e precisa da navegação de volta visível mesmo durante
// loading/"não encontrado" — antes dos dados do pedido existirem.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { cn } from "@/lib/utils";

export function BackLink({
  href,
  label,
  className = "",
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-brand-navy transition-colors duration-300 hover:text-brand-orange",
        className,
      )}
    >
      <ArrowLeft
        aria-hidden
        className="h-4 w-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-1 motion-reduce:transition-none"
      />
      {label}
    </Link>
  );
}

type AccountPageHeaderProps = {
  backHref?: string;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  className?: string;
};

export default function AccountPageHeader({
  backHref,
  backLabel,
  eyebrow = "Minha Conta",
  title,
  description,
  className = "",
}: AccountPageHeaderProps) {
  return (
    <RevealOnScroll className={className}>
      {backHref && backLabel && (
        <BackLink href={backHref} label={backLabel} className="mb-6" />
      )}
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
        {eyebrow}
      </p>
      <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
        {title}
      </h1>
      {description && (
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
          {description}
        </p>
      )}
    </RevealOnScroll>
  );
}
