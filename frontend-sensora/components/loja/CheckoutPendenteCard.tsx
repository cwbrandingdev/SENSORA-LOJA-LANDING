"use client";

import Button from "@/components/ui/Button";
import type { CheckoutPendente } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type CheckoutPendenteCardProps = {
  pendente: CheckoutPendente;
  pagando: boolean;
  onPagar: () => void;
};

export default function CheckoutPendenteCard({
  pendente,
  pagando,
  onPagar,
}: CheckoutPendenteCardProps) {
  return (
    <div className="rounded-sm border border-brand-orange/40 bg-brand-orange/5 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
        Pagamento pendente
      </p>
      <h2 className="mt-3 font-serif text-xl font-normal text-brand-navy">
        Você tem uma compra para pagar
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Pedido {pendente.pedidoNumero} · {formatPrice.format(pendente.total)}.
        Não é preciso criar um pedido novo — o pagamento já foi iniciado.
      </p>
      <Button
        onClick={onPagar}
        variant="primary"
        className="mt-5 w-full"
        disabled={pagando}
      >
        {pagando ? "Abrindo pagamento..." : "Pagar agora →"}
      </Button>
    </div>
  );
}
