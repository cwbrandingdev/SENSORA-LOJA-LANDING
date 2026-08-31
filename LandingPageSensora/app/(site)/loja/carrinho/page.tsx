"use client";

// Página do carrinho — client component porque depende inteiramente do
// CartContext (estado local, Task 1). Reaproveita RevealOnScroll, Button,
// EmptyState e o mesmo cabeçalho editorial (eyebrow + h1 serif) já usado em
// /loja e /loja/produtos — nenhum padrão visual novo, só a composição.
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import CartItemRow from "@/components/loja/CartItemRow";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { loginComRedirect, possuiSessaoValida } from "@/lib/auth-redirect";
import { ROUTES } from "@/lib/routes";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function CarrinhoPage() {
  const router = useRouter();
  const { itens, totalItens, subtotal, limparCarrinho } = useCart();
  const toast = useToast();

  function handleLimparCarrinho() {
    if (!window.confirm("Esvaziar o carrinho? Essa ação não pode ser desfeita.")) {
      return;
    }
    limparCarrinho();
    toast.success("Carrinho esvaziado.");
  }

  // Checkout exige sessão válida — visitante sem login vai para /login
  // preservando /loja/checkout como destino de retorno; o carrinho em si
  // (CartContext/localStorage) não é tocado aqui de forma alguma.
  function handleIrParaCheckout() {
    router.push(
      possuiSessaoValida() ? ROUTES.LOJA_CHECKOUT : loginComRedirect(ROUTES.LOJA_CHECKOUT),
    );
  }

  return (
    <>
      <section className="relative mx-auto max-w-3xl overflow-hidden px-6 pt-28 pb-8 text-center sm:pt-36 lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Loja
          </p>
          <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
            Seu carrinho
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            {totalItens > 0
              ? `${totalItens} ${totalItens === 1 ? "item" : "itens"} prontos para o checkout.`
              : "Revise os produtos antes de seguir para o pagamento."}
          </p>
        </RevealOnScroll>
      </section>

      {itens.length === 0 ? (
        <div className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40">
          <RevealOnScroll>
            <EmptyState
              eyebrow="Carrinho"
              title="Ainda não há nada por aqui"
              message="Explore a loja e encontre o aroma perfeito para o seu ambiente."
            />
            <div className="flex justify-center">
              <Button href={ROUTES.LOJA_PRODUTOS} variant="primary">
                Ver catálogo →
              </Button>
            </div>
          </RevealOnScroll>
        </div>
      ) : (
        <section className="mx-auto max-w-6xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
            <RevealOnScroll>
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <h2 className="font-serif text-xl font-normal text-brand-navy">
                  Produtos
                </h2>
                {/* Task 17: mesmo sublinhado-revelado do Navbar/Footer em vez
                    de só trocar a cor no hover — linguagem de link já
                    estabelecida no resto da Loja, aplicada aqui pela
                    primeira vez no carrinho. */}
                <button
                  type="button"
                  onClick={handleLimparCarrinho}
                  className="group relative text-[13px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                >
                  Esvaziar carrinho
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                  />
                </button>
              </div>

              <ul className="divide-y divide-slate-200">
                {itens.map((item) => (
                  <CartItemRow key={item.produtoId} item={item} />
                ))}
              </ul>
            </RevealOnScroll>

            <RevealOnScroll delayMs={90}>
              <aside className="rounded-sm border border-slate-200 p-6 lg:sticky lg:top-28">
                <h2 className="font-serif text-xl font-normal text-brand-navy">
                  Resumo do pedido
                </h2>

                {/* Total = subtotal por enquanto — frete/desconto entram no
                    checkout (próxima etapa), não aqui. */}
                <dl className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Subtotal</dt>
                    <dd className="font-medium tabular-nums text-brand-navy">
                      {formatPrice.format(subtotal)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
                    <dt className="font-semibold text-brand-navy">Total</dt>
                    <dd className="text-lg font-semibold tabular-nums text-brand-navy">
                      {formatPrice.format(subtotal)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-col gap-3">
                  <Button onClick={handleIrParaCheckout} variant="primary" className="w-full">
                    Ir para o checkout →
                  </Button>
                  <Link
                    href={ROUTES.LOJA_PRODUTOS}
                    className="text-center text-[13px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                  >
                    ← Continuar comprando
                  </Link>
                </div>
              </aside>
            </RevealOnScroll>
          </div>
        </section>
      )}
    </>
  );
}
