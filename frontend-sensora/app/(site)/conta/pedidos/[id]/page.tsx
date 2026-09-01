"use client";

// Etapa 2 (Minha Conta / Detalhes + Acompanhar Pedido) — GET
// /pedidos/meus/:id (services/pedidos.ts#buscarMeuPedido). Ownership é
// resolvido inteiramente no backend (PedidosService.findOne, reaproveitado
// sem alteração): pedido inexistente e pedido de outro usuário devolvem o
// MESMO 404 genérico, então esta página trata os dois casos de forma
// idêntica — nunca tenta adivinhar qual dos dois aconteceu (evita
// enumeração de IDs).
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { isAxiosError } from "axios";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import EmptyState from "@/components/ui/EmptyState";
import StatusPedidoBadge from "@/components/conta/StatusPedidoBadge";
import AcompanhamentoPedido from "@/components/conta/AcompanhamentoPedido";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { buscarMeuPedido } from "@/services/pedidos";
import { ROUTES } from "@/lib/routes";
import type { PedidoComItensDetalhado } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function MeuPedidoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);
  const toast = useToast();

  const [dados, setDados] = useState<PedidoComItensDetalhado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  useEffect(() => {
    // Id fora da URL não é um número válido — mesmo resultado prático de um
    // pedido inexistente, sem depender de como o backend reagiria a um path
    // param malformado (mesmo raciocínio já usado no detalhe do Admin).
    if (!Number.isInteger(pedidoId)) {
      setNaoEncontrado(true);
      setCarregando(false);
      return;
    }

    buscarMeuPedido(pedidoId)
      .then(setDados)
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 404) {
          setNaoEncontrado(true);
        } else {
          toast.error(getErrorMessage(err, "Não foi possível carregar o pedido."));
        }
      })
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  return (
    <div className="mx-auto max-w-4xl px-6 pt-28 pb-24 sm:pt-36 sm:pb-32 lg:px-10">
      <p>
        <Link
          href={ROUTES.CONTA_PEDIDOS}
          className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-navy hover:text-brand-orange"
        >
          ← Voltar para meus pedidos
        </Link>
      </p>

      {carregando ? (
        <p className="mt-10 text-sm text-slate-500">Carregando pedido...</p>
      ) : naoEncontrado || !dados ? (
        <div className="mt-4">
          <EmptyState
            eyebrow="Pedidos"
            title="Pedido não encontrado"
            message="Esse pedido não existe ou não pertence à sua conta."
          />
        </div>
      ) : (
        <RevealOnScroll>
          <div className="mt-8 flex flex-col gap-2 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
                Pedido {dados.pedido.numero}
              </p>
              <h1 className="mt-2 font-serif text-3xl font-normal tracking-tight text-brand-navy sm:text-4xl">
                {new Date(dados.pedido.data).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </h1>
            </div>
            <StatusPedidoBadge status={dados.pedido.status} />
          </div>

          <div className="mt-8">
            <h2 className="font-serif text-xl font-normal text-brand-navy">
              Acompanhamento
            </h2>
            <div className="mt-4">
              <AcompanhamentoPedido status={dados.pedido.status} />
            </div>
          </div>

          <div className="mt-10">
            <h2 className="font-serif text-xl font-normal text-brand-navy">
              Itens do pedido
            </h2>
            <ul className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
              {dados.itens.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-brand-navy">{item.produtoNome}</p>
                    <p className="text-sm text-slate-500">
                      {item.quantidade} × {formatPrice.format(item.precoUnitario)}
                    </p>
                  </div>
                  <p className="font-medium tabular-nums text-brand-navy">
                    {formatPrice.format(item.subtotal)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-base">
              <p className="font-semibold text-brand-navy">Total</p>
              <p className="text-lg font-semibold tabular-nums text-brand-navy">
                {formatPrice.format(dados.total)}
              </p>
            </div>
          </div>

          <div className="mt-10">
            <h2 className="font-serif text-xl font-normal text-brand-navy">
              Endereço de entrega
            </h2>
            {/* Achado da auditoria da Etapa 2: o schema de Pedido não
                persiste qual endereço foi usado no checkout (decisão já
                registrada na Task 15) — mostrar isso claramente em vez de
                inventar um dado que o sistema não tem. */}
            <p className="mt-3 text-sm text-slate-500">
              Endereço de entrega não disponível para este pedido.
            </p>
          </div>
        </RevealOnScroll>
      )}
    </div>
  );
}
