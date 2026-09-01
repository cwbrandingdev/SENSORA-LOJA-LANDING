// Task 12 (+ Task 21 — migração Stripe → Asaas) — retorno visual do
// checkout, não fonte de verdade do pagamento. Esta página só é alcançada
// pelo `callback.successUrl` configurado no backend (ver
// CheckoutService.createSession) depois que o Asaas Checkout redireciona o
// cliente de volta — ela NÃO confirma o pagamento, NÃO cria/lê pedido e NÃO
// baixa estoque. Essas responsabilidades continuam sendo só do webhook
// (POST /checkout/webhook, evento CHECKOUT_PAID).
//
// Etapa 2 (Minha Conta / limpeza do carrinho) — a ÚNICA coisa nova que esta
// página passou a fazer: confirmar, via GET /checkout/session/:sessionId
// (backend, já existente), se a sessão marcada como pendente em
// /loja/checkout (ver setCheckoutPendente) realmente está paga antes de
// esvaziar o carrinho. Chegar nesta URL não é prova de pagamento — é só um
// redirect do navegador feito pelo Asaas Checkout, sem garantia
// criptográfica (diferente do webhook, que é server-to-server e é quem
// decide de verdade o status do Pedido). Por isso o carrinho só é
// esvaziado depois dessa confirmação, nunca só por ter chegado aqui:
//   - sem marcador pendente (navegação direta, ou já consumido em um mount
//     anterior) -> não faz nada, não limpa, idempotente em reload;
//   - marcador presente mas status não é "PAGO" (ou a chamada falha) ->
//     não limpa o carrinho;
//   - status "PAGO" -> limpa o carrinho e consome o marcador.
// O marcador é sempre consumido (removido) ao final da tentativa, sucesso
// ou não, para nunca repetir a checagem indefinidamente num reload.
//
// O `status` devolvido por GET /checkout/session/:sessionId reflete
// Pedido.status (StatusPedido: PENDENTE/PAGO/CANCELADO) sempre que há um
// pedido vinculado — nunca o status "cru" do Checkout na Asaas. Achado da
// auditoria: um Checkout já convertido em Payment deixa de existir do lado
// da Asaas (GET /checkouts/{id} passa a 404 mesmo para o dono), então
// depender do Asaas aqui quebraria exatamente o caso de quem acabou de
// pagar — ver comentário em CheckoutService.getSessionStatus (backend).
"use client";

import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { useCart } from "@/context/CartContext";
import { buscarStatusSessao } from "@/services/checkout";
import { getCheckoutPendente, removeCheckoutPendente } from "@/lib/storage";
import { ROUTES } from "@/lib/routes";
import { StatusPedido } from "@/lib/types/loja";

export default function CheckoutSucessoPage() {
  const { limparCarrinho } = useCart();

  useEffect(() => {
    const sessionId = getCheckoutPendente();
    if (!sessionId) return;

    let cancelado = false;

    buscarStatusSessao(sessionId)
      .then((status) => {
        if (!cancelado && status.status === StatusPedido.PAGO) {
          limparCarrinho();
        }
      })
      .catch(() => {
        // Falha ao confirmar (rede, sessão expirada, sessionId de outro
        // usuário etc.) — não limpa o carrinho; o cliente decide o que fazer.
      })
      .finally(() => {
        removeCheckoutPendente();
      });

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
