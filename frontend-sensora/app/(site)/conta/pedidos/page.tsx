"use client";

// Etapa 2 (Minha Conta / Meus Pedidos) — GET /pedidos/meus
// (services/pedidos.ts#listarMeusPedidos): o backend já filtra pelo usuário
// autenticado (nunca por um parâmetro enviado daqui), então esta página só
// exibe o que a API devolver, sem nenhuma lógica extra de ownership no
// cliente.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import AccountPageHeader from "@/components/conta/AccountPageHeader";
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

// Etapa 6.1 (Refinamento) — teto de atraso do stagger de entrada dos cards
// (item 10 da etapa: "não animar exageradamente cada item") — sem isso, uma
// lista longa faria o último card demorar segundos pra aparecer.
const STAGGER_STEP_MS = 60;
const STAGGER_CAP_MS = 300;

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
      <AccountPageHeader
        backHref={ROUTES.CONTA}
        backLabel="Voltar para Minha Conta"
        title="Meus pedidos"
        description="Acompanhe aqui o histórico e o status dos seus pedidos."
      />

      <div className="mt-10">
        {pedidos === null ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-[84px] rounded-sm" />
            <Skeleton className="h-[84px] rounded-sm" />
            <Skeleton className="h-[84px] rounded-sm" />
          </div>
        ) : pedidos.length === 0 ? (
          <RevealOnScroll delayMs={90}>
            <EmptyState
              eyebrow="Pedidos"
              icon={Package}
              title="Você ainda não tem pedidos"
              message="Quando você fizer uma compra, ela vai aparecer aqui."
              action={<Button href={ROUTES.LOJA_PRODUTOS}>Conhecer produtos</Button>}
            />
          </RevealOnScroll>
        ) : (
          <ul className="flex flex-col gap-3">
            {pedidos.map((pedido, index) => (
              <RevealOnScroll
                key={pedido.id}
                delayMs={Math.min(index * STAGGER_STEP_MS, STAGGER_CAP_MS)}
              >
                <li>
                  <Link
                    href={`${ROUTES.CONTA_PEDIDOS}/${pedido.id}`}
                    className="group flex flex-col gap-3 rounded-sm border border-slate-200 bg-white p-5 transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-brand-navy/30 hover:shadow-lg hover:shadow-brand-navy/5 motion-reduce:hover:translate-y-0 sm:flex-row sm:items-center sm:justify-between"
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
                      <ArrowRight
                        aria-hidden
                        className="hidden h-4 w-4 shrink-0 text-brand-orange opacity-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:opacity-100 sm:block"
                      />
                    </div>
                  </Link>
                </li>
              </RevealOnScroll>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
