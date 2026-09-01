"use client";

// Etapa 2 (Minha Conta / Meus Pedidos) — GET /pedidos/meus
// (services/pedidos.ts#listarMeusPedidos): o backend já filtra pelo usuário
// autenticado (nunca por um parâmetro enviado daqui), então esta página só
// exibe o que a API devolver, sem nenhuma lógica extra de ownership no
// cliente.
import { useEffect, useState } from "react";
import Link from "next/link";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import EmptyState from "@/components/ui/EmptyState";
import StatusPedidoBadge from "@/components/conta/StatusPedidoBadge";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { listarMeusPedidos } from "@/services/pedidos";
import { ROUTES } from "@/lib/routes";
import type { Pedido } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function MeusPedidosPage() {
  const toast = useToast();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);

  useEffect(() => {
    listarMeusPedidos()
      .then(setPedidos)
      .catch((err) => {
        setPedidos([]);
        toast.error(getErrorMessage(err, "Não foi possível carregar seus pedidos."));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 pt-28 pb-24 sm:pt-36 sm:pb-32 lg:px-10">
      <RevealOnScroll>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Minha Conta
        </p>
        <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
          Meus pedidos
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
          Acompanhe aqui o histórico e o status dos seus pedidos.
        </p>
      </RevealOnScroll>

      <RevealOnScroll delayMs={90}>
        <div className="mt-10">
          {pedidos === null ? (
            <p className="text-sm text-slate-500">Carregando pedidos...</p>
          ) : pedidos.length === 0 ? (
            <EmptyState
              eyebrow="Pedidos"
              title="Você ainda não tem pedidos"
              message="Quando você fizer uma compra, ela vai aparecer aqui."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {pedidos.map((pedido) => (
                <li key={pedido.id}>
                  <Link
                    href={`${ROUTES.CONTA_PEDIDOS}/${pedido.id}`}
                    className="flex flex-col gap-2 rounded-sm border border-slate-200 p-5 transition-colors hover:border-brand-navy/30 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-serif text-lg font-normal text-brand-navy">
                        Pedido {pedido.numero}
                      </p>
                      <p className="text-sm text-slate-500">
                        {new Date(pedido.data).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusPedidoBadge status={pedido.status} />
                      <p className="font-semibold tabular-nums text-brand-navy">
                        {formatPrice.format(pedido.total)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </RevealOnScroll>
    </div>
  );
}
