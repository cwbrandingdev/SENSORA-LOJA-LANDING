// Task 13 (+ Task 21 — migração Stripe → Asaas) — retorno visual do
// checkout quando o pagamento é cancelado/interrompido/expirado, não fonte
// de verdade do estado do pagamento. Esta página só é alcançada pelo
// `callback.cancelUrl`/`callback.expiredUrl` configurados no backend (ver
// CheckoutService.createSession) — ela NÃO consulta /checkout/session, NÃO
// consulta o Asaas, NÃO consulta/cria pedido, NÃO altera estoque e NÃO
// limpa o carrinho. Nenhuma decisão é tomada a partir de query params — a
// página renderiza sempre o mesmo conteúdo estático, independente do que
// vier na URL. Mesma estrutura de app/(site)/checkout/sucesso/page.tsx
// (Task 12), só o tom/ícone/CTAs mudam para refletir um pagamento não
// concluído em vez de concluído.
// Client component pela mesma razão de RevealOnScroll (IntersectionObserver)
// — nenhum estado/efeito de dados aqui.
"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { ROUTES } from "@/lib/routes";

export default function CheckoutCanceladoPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 pt-28 pb-24 text-center sm:pt-36 sm:pb-32 lg:px-10">
      <RevealOnScroll>
        <div
          aria-hidden
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-navy ring-2 ring-slate-300 ring-offset-4 ring-offset-background"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Checkout
        </p>
        <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
          Pagamento não concluído
        </h1>
      </RevealOnScroll>

      <RevealOnScroll delayMs={90}>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-slate-600">
          O pagamento foi cancelado ou interrompido antes de ser concluído.
          Seus itens continuam no carrinho — você pode voltar à loja e
          tentar novamente quando quiser.
        </p>
      </RevealOnScroll>

      <RevealOnScroll delayMs={180}>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button href={ROUTES.LOJA} variant="primary">
            Voltar para a loja →
          </Button>
          <Link
            href={ROUTES.LOJA_CARRINHO}
            className="text-[13px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-brand-navy"
          >
            Voltar ao carrinho
          </Link>
        </div>
      </RevealOnScroll>
    </div>
  );
}
