// Destaque de pedidos aguardando envio no topo de /workspace-x/pedidos —
// "aguardando envio" nunca é um status novo: é a combinação de dois status
// que já existem (status === PAGO && statusEnvio === NAO_ENVIADO, a mesma
// condição que já habilita "Marcar como enviado" em PedidoTable.tsx). Este
// componente só recebe a lista já filtrada pelo pai (PedidosPage) — nenhuma
// lógica de status/filtro mora aqui, só apresentação.
import Link from "next/link";
import { Package } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { ROUTES } from "@/lib/routes";
import type { Pedido } from "@/lib/types/loja";

// Mesma correção de fuso já aplicada em PedidoTable.tsx/conta/pedidos: `data`
// é meia-noite UTC representando um DIA de calendário — sem timeZone:"UTC"
// aqui, toLocaleDateString exibiria o dia anterior em fusos negativos
// (America/Sao_Paulo incluso).
function formatarData(data: string): string {
  return new Date(data).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

type PedidosParaEnviarCardProps = {
  pedidos: Pedido[];
};

export default function PedidosParaEnviarCard({ pedidos }: PedidosParaEnviarCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
          >
            <Package className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
              Pedidos para enviar
            </p>
            <p className="mt-0.5 text-2xl font-semibold text-brand-navy">
              {pedidos.length === 0
                ? "Nenhum pedido aguardando envio"
                : `${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"} aguardando envio`}
            </p>
          </div>
        </div>
      </div>

      {pedidos.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="px-4 py-2.5 font-medium">Pedido</th>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pedidos.map((pedido) => (
                <tr key={pedido.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-brand-navy">{pedido.numero}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {pedido.clienteNome ?? pedido.clienteEmail ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatarData(pedido.data)}</td>
                  <td className="px-4 py-3">
                    <Badge tone="warning">Aguardando envio</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${ROUTES.PEDIDOS}/${pedido.id}`}
                      className="inline-flex items-center justify-center rounded-md border border-brand-navy px-3 py-1.5 text-sm font-medium text-brand-navy transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                    >
                      Ver itens
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
