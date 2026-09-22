"use client";

// Fase B (Admin/Clientes reais) — detalhe administrativo de um cliente real
// (Usuario com perfil CLIENTE), construído sobre GET /usuarios/:id/detalhes
// (backend/src/usuarios/usuarios.controller.ts). Convive com o CRUD legado
// em app/workspace-x/clientes/page.tsx (model Cliente, desconectado de
// Pedido/Usuario) sem alterá-lo — são fontes de dado diferentes, ver
// vistoria "Clientes reais" para o raciocínio completo. Esta página não
// duplica o detalhe do pedido (app/workspace-x/pedidos/[id]/page.tsx): cada
// pedido listado aqui só linka para lá.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { isAxiosError } from "axios";
import EmptyState from "@/components/ui/EmptyState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import MetricCard from "@/components/admin/MetricCard";
import { ClipboardList, Wallet, CalendarClock } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { formatarCpf } from "@/lib/cpf";
import { formatarTelefone } from "@/lib/telefone";
import { ROUTES } from "@/lib/routes";
import { buscarDetalheCliente } from "@/services/usuarios";
import { StatusPedido, type ClienteDetalhado } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Mesmos rótulos/tons já usados em components/tables/PedidoTable.tsx e em
// app/workspace-x/pedidos/[id]/page.tsx — nenhum status/cor novo, só
// repetido aqui (mesmo padrão de cópia local já usado nesses dois
// arquivos; nenhum export compartilhado existe hoje para importar em vez
// disso).
const STATUS_LABEL: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "Pendente",
  [StatusPedido.PAGO]: "Pago",
  [StatusPedido.CANCELADO]: "Cancelado",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "Reembolso solicitado",
  [StatusPedido.REEMBOLSADO]: "Reembolsado",
};

const STATUS_TONE: Record<StatusPedido, BadgeTone> = {
  [StatusPedido.PENDENTE]: "warning",
  [StatusPedido.PAGO]: "success",
  [StatusPedido.CANCELADO]: "danger",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "info",
  [StatusPedido.REEMBOLSADO]: "neutral",
};

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const clienteId = Number(id);

  const [cliente, setCliente] = useState<ClienteDetalhado | null>(null);
  const [loading, setLoading] = useState(true);
  const [clienteNaoEncontrado, setClienteNaoEncontrado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarCliente() {
    setLoading(true);
    setClienteNaoEncontrado(false);
    setErro(null);

    // Mesmo raciocínio já usado em app/workspace-x/pedidos/[id]/page.tsx:
    // id fora da URL não é um número válido — mesmo resultado prático de um
    // cliente inexistente, sem depender de como o backend reagiria a um
    // path param malformado.
    if (!Number.isInteger(clienteId)) {
      setClienteNaoEncontrado(true);
      setLoading(false);
      return;
    }

    try {
      const dados = await buscarDetalheCliente(clienteId);
      setCliente(dados);
    } catch (err) {
      // 404 cobre tanto "id inexistente" quanto "id existe mas não é
      // CLIENTE" (ver UsuariosService.buscarDetalheCliente — mesmo 404
      // genérico para os dois casos, nunca distinguido aqui).
      if (isAxiosError(err) && err.response?.status === 404) {
        setClienteNaoEncontrado(true);
      } else {
        setErro(getErrorMessage(err, "Não foi possível carregar o cliente."));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarCliente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link
          href={ROUTES.CLIENTES}
          className="text-sm font-medium text-brand-navy hover:underline"
        >
          ← Voltar para clientes
        </Link>
      </p>

      {clienteNaoEncontrado ? (
        <EmptyState
          eyebrow="Erro"
          title="Cliente não encontrado"
          message="O cliente solicitado não existe ou não foi localizado."
        />
      ) : erro ? (
        <InlineErrorState message={erro} onRetry={carregarCliente} />
      ) : loading || !cliente ? (
        <TableSkeleton rows={3} columns={4} />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-brand-navy">{cliente.nome}</h2>
              <p className="text-sm text-slate-500">{cliente.email}</p>
            </div>
            <Badge tone={cliente.ativo ? "success" : "neutral"}>
              {cliente.ativo ? "Ativo" : "Inativo"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                CPF
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {cliente.cpf ? formatarCpf(cliente.cpf) : "Não informado"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Telefone
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {cliente.telefone ? formatarTelefone(cliente.telefone) : "Não informado"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                E-mail confirmado
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {cliente.emailVerificado ? "Sim" : "Não"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              titulo="Pedidos"
              icon={ClipboardList}
              iconTone="navy"
              valor={String(cliente.resumo.quantidadePedidos)}
            />
            <MetricCard
              titulo="Total comprado"
              icon={Wallet}
              iconTone="orange"
              valor={formatPrice.format(cliente.resumo.totalComprado)}
              descricao="Soma dos pedidos pagos"
            />
            <MetricCard
              titulo="Último pedido"
              icon={CalendarClock}
              iconTone="navy-outline"
              valor={
                cliente.resumo.ultimoPedidoEm
                  ? new Date(cliente.resumo.ultimoPedidoEm).toLocaleDateString("pt-BR", {
                      timeZone: "UTC",
                    })
                  : "—"
              }
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-brand-navy">Endereços</h3>
            {cliente.enderecos.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Nenhum endereço cadastrado.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3 divide-y divide-slate-100">
                {cliente.enderecos.map((endereco) => (
                  <li key={endereco.id} className="pt-3 first:pt-0">
                    <address className="text-sm leading-relaxed text-slate-700 not-italic">
                      <p>
                        {endereco.rua}, {endereco.numero}
                        {endereco.padrao && (
                          <span className="ml-2 text-xs font-medium uppercase tracking-wide text-brand-orange">
                            Padrão
                          </span>
                        )}
                      </p>
                      {endereco.complemento && <p>{endereco.complemento}</p>}
                      <p>{endereco.bairro}</p>
                      <p>
                        {endereco.cidade} / {endereco.estado}
                      </p>
                      <p>CEP {endereco.cep}</p>
                    </address>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <h3 className="px-4 pt-4 text-sm font-semibold text-brand-navy">
              Histórico de pedidos
            </h3>
            {cliente.pedidos.length === 0 ? (
              <p className="px-4 pb-4 pt-2 text-sm text-slate-500">
                Este cliente ainda não fez nenhum pedido.
              </p>
            ) : (
              <table className="mt-3 w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Número
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Data
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cliente.pedidos.map((pedido) => (
                    <tr key={pedido.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <Link
                          href={`${ROUTES.PEDIDOS}/${pedido.id}`}
                          className="text-brand-navy hover:underline"
                        >
                          {pedido.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(pedido.data).toLocaleDateString("pt-BR", {
                          timeZone: "UTC",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[pedido.status]}>
                          {STATUS_LABEL[pedido.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {formatPrice.format(pedido.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
