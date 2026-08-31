// Task 12 (+ Task 21 — migração Stripe → Asaas) — retorno visual do
// checkout, não fonte de verdade do pagamento. Esta página só é alcançada
// pelo `callback.successUrl` configurado no backend (ver
// CheckoutService.createSession) depois que o Asaas Checkout redireciona o
// cliente de volta — ela NÃO confirma o pagamento, NÃO consulta o backend,
// NÃO cria/lê pedido e NÃO baixa estoque. Essas responsabilidades são do
// webhook (POST /checkout/webhook, evento CHECKOUT_PAID).
// Client component só pela mesma razão de RevealOnScroll em outras páginas
// da Loja (IntersectionObserver) — nenhum estado/efeito de dados aqui.
"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { ROUTES } from "@/lib/routes";

export default function CheckoutSucessoPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 pt-28 pb-24 text-center sm:pt-36 sm:pb-32 lg:px-10">
      <RevealOnScroll>
        <div
          aria-hidden
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-navy ring-2 ring-brand-orange/30 ring-offset-4 ring-offset-background"
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
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Checkout
        </p>
        <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
          Pagamento realizado com sucesso
        </h1>
      </RevealOnScroll>

      <RevealOnScroll delayMs={90}>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-slate-600">
          Seu pagamento foi concluído com sucesso. Em breve você poderá
          acompanhar os detalhes do seu pedido — por enquanto, aproveite para
          continuar explorando a Sensora.
        </p>
      </RevealOnScroll>

      <RevealOnScroll delayMs={180}>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button href={ROUTES.LOJA} variant="primary">
            Voltar para a loja →
          </Button>
          <Link
            href={ROUTES.LOJA_PRODUTOS}
            className="text-[13px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-brand-navy"
          >
            Continuar comprando
          </Link>
        </div>
      </RevealOnScroll>
    </div>
  );
}
