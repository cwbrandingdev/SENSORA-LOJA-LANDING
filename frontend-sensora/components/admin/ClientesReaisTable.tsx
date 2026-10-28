"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ExternalLink, Users } from "lucide-react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { formatarCpf } from "@/lib/cpf";
import { formatarTelefone } from "@/lib/telefone";
import { ROUTES } from "@/lib/routes";
import { StatusPedido, type ClienteListagem, type PedidoResumoCliente } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const STATUS_LABEL: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "Pendente",
  [StatusPedido.PAGO]: "Pago",
  [StatusPedido.CANCELADO]: "Cancelado",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "Reembolso",
  [StatusPedido.REEMBOLSADO]: "Reembolsado",
};

type ClientesReaisTableProps = {
  clientes: ClienteListagem[];
};

function resumoProdutos(cliente: ClienteListagem): string {
  if (cliente.produtosComprados.length === 0) {
    return cliente.resumo.quantidadePedidos > 0
      ? "Pedidos sem itens pagos"
      : "Nenhuma compra ainda";
  }
  const top = cliente.produtosComprados.slice(0, 2).map((p) => p.produtoNome);
  const extra =
    cliente.produtosComprados.length > 2
      ? ` +${cliente.produtosComprados.length - 2}`
      : "";
  return top.join(", ") + extra;
}

function TabelaPedidosExpandida({ pedidos }: { pedidos: PedidoResumoCliente[] }) {
  if (pedidos.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-slate-500">Este cliente ainda não tem pedidos.</p>
    );
  }

  return (
    <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Pedidos do cliente — clique no número para abrir no admin
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500">
                Pedido
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500">
                Data
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500">
                Status
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500">
                Total
              </th>
              <th className="w-24 px-4 py-2.5 text-right text-xs font-semibold uppercase text-slate-500">
                Abrir
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pedidos.map((pedido) => (
              <Fragment key={pedido.id}>
                <tr className="hover:bg-slate-50/80">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`${ROUTES.PEDIDOS}/${pedido.id}`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      {pedido.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {new Date(pedido.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">
                    {STATUS_LABEL[pedido.status]}
                  </td>
                  <td className="px-4 py-2.5 font-medium tabular-nums text-slate-900">
                    {formatPrice.format(pedido.total)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`${ROUTES.PEDIDOS}/${pedido.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-orange hover:underline"
                    >
                      Ver pedido
                      <ExternalLink aria-hidden className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
                {pedido.itens.length > 0 && (
                  <tr className="bg-slate-50/50">
                    <td colSpan={5} className="px-4 py-2">
                      <ul className="flex flex-col gap-0.5 text-xs text-slate-600">
                        {pedido.itens.map((item, index) => (
                          <li key={`${pedido.id}-${index}`}>
                            {item.quantidade}× {item.produtoNome} —{" "}
                            {formatPrice.format(item.subtotal)}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ClientesReaisTable({ clientes }: ClientesReaisTableProps) {
  const [expandidoId, setExpandidoId] = useState<number | null>(null);

  function alternarPedidos(clienteId: number) {
    setExpandidoId((atual) => (atual === clienteId ? null : clienteId));
  }

  if (clientes.length === 0) {
    return (
      <EmptyState
        compact
        eyebrow="Clientes"
        title="Nenhuma conta de cliente"
        message="As contas aparecem aqui quando alguém se cadastra na loja."
        icon={Users}
      />
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-4 md:hidden">
        {clientes.map((cliente) => {
          const aberto = expandidoId === cliente.id;
          return (
            <li
              key={cliente.id}
              className="rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`${ROUTES.CLIENTES}/${cliente.id}`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      {cliente.nome}
                    </Link>
                    <p className="truncate text-sm text-slate-600">{cliente.email}</p>
                  </div>
                  <Badge tone={cliente.ativo ? "success" : "neutral"}>
                    {cliente.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <dt className="text-slate-400">Pedidos</dt>
                    <dd className="font-medium text-slate-800">
                      {cliente.resumo.quantidadePedidos}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Total pago</dt>
                    <dd className="font-medium tabular-nums text-slate-800">
                      {formatPrice.format(cliente.resumo.totalComprado)}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => alternarPedidos(cliente.id)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-slate-100"
                >
                  {aberto ? (
                    <ChevronDown aria-hidden className="h-4 w-4" />
                  ) : (
                    <ChevronRight aria-hidden className="h-4 w-4" />
                  )}
                  {aberto ? "Ocultar pedidos" : `Ver pedidos (${cliente.pedidos.length})`}
                </button>
              </div>
              {aberto && <TabelaPedidosExpandida pedidos={cliente.pedidos} />}
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="w-10 px-3 py-3.5" aria-label="Expandir pedidos" />
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Cliente
              </th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Contato
              </th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Compras
              </th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Produtos (pagos)
              </th>
              <th className="w-28 px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Perfil
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientes.map((cliente) => {
              const aberto = expandidoId === cliente.id;
              return (
                <Fragment key={cliente.id}>
                  <tr className="align-top transition-colors hover:bg-slate-50/70">
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        onClick={() => alternarPedidos(cliente.id)}
                        disabled={cliente.pedidos.length === 0}
                        aria-expanded={aberto}
                        aria-label={
                          cliente.pedidos.length === 0
                            ? "Sem pedidos"
                            : aberto
                              ? "Ocultar pedidos"
                              : `Ver ${cliente.pedidos.length} pedidos`
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-brand-navy transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {aberto ? (
                          <ChevronDown aria-hidden className="h-4 w-4" />
                        ) : (
                          <ChevronRight aria-hidden className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`${ROUTES.CLIENTES}/${cliente.id}`}
                        className="font-medium text-brand-navy hover:underline"
                      >
                        {cliente.nome}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge tone={cliente.ativo ? "success" : "neutral"}>
                          {cliente.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                        {cliente.emailVerificado && (
                          <Badge tone="info">E-mail ok</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <p className="max-w-50 truncate" title={cliente.email}>
                        {cliente.email}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {cliente.telefone ? formatarTelefone(cliente.telefone) : "—"}
                        {cliente.cpf && (
                          <span className="ml-2 tabular-nums">
                            CPF {formatarCpf(cliente.cpf)}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => alternarPedidos(cliente.id)}
                        disabled={cliente.pedidos.length === 0}
                        className="text-left disabled:cursor-default"
                      >
                        <p className="font-medium tabular-nums text-slate-900 underline-offset-2 hover:underline disabled:no-underline">
                          {formatPrice.format(cliente.resumo.totalComprado)}
                        </p>
                        <p className="mt-0.5 text-xs text-brand-orange hover:underline disabled:text-slate-500 disabled:no-underline">
                          {cliente.resumo.quantidadePedidos === 0
                            ? "Nenhum pedido"
                            : `${cliente.resumo.quantidadePedidos} pedido(s) — clique para ver`}
                        </p>
                      </button>
                    </td>
                    <td className="max-w-55 px-5 py-4">
                      <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">
                        {resumoProdutos(cliente)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`${ROUTES.CLIENTES}/${cliente.id}`}
                        className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-orange hover:underline"
                      >
                        Perfil
                        <ChevronRight aria-hidden className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                  {aberto && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <TabelaPedidosExpandida pedidos={cliente.pedidos} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
