"use client";

// Etapa 8.1 (complemento — eliminação da venda manual) — esta página não
// permite mais adicionar itens a um pedido. "Adicionar item" foi removido
// de propósito: a Sensora não tem venda manual, então não existe mais forma
// de montar uma venda item a item pela área administrativa (os itens de um
// pedido nascem exclusivamente do Checkout). O que resta aqui é só
// gerenciamento de itens já existentes (corrigir quantidade/produto,
// remover) — nunca criar um item novo do zero.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { isAxiosError } from "axios";
import ItemPedidoTable from "@/components/tables/ItemPedidoTable";
import ItemPedidoForm, { type ItemPedidoFormValues } from "@/components/forms/ItemPedidoForm";
import EmptyState from "@/components/ui/EmptyState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { buscarPedidoComItens, atualizarPedido } from "@/services/pedidos";
import { atualizarItemPedido, removerItemPedido } from "@/services/itensPedido";
import { listarProdutos } from "@/services/produtos";
import { ROUTES } from "@/lib/routes";
import { StatusPedido, type Pedido, type ItemPedido, type Produto } from "@/lib/types/loja";

// Mesmos tons de PedidoTable.tsx (Admin) — só o nome do status muda, a
// receita visual é a mesma em toda a aba Pedidos.
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

export default function PedidoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);
  const toast = useToast();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pedidoNaoEncontrado, setPedidoNaoEncontrado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ItemPedido | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  async function carregarPedido() {
    setLoading(true);
    setPedidoNaoEncontrado(false);
    setErro(null);

    // ID fora da URL não é um número válido — mesmo resultado prático de um
    // pedido inexistente, sem depender de como o backend reagiria a um path
    // param malformado (Task 19).
    if (Number.isNaN(pedidoId)) {
      setPedidoNaoEncontrado(true);
      setLoading(false);
      return;
    }

    try {
      const [pedidoComItens, listaProdutos] = await Promise.all([
        buscarPedidoComItens(pedidoId),
        listarProdutos(),
      ]);

      setProdutos(listaProdutos);
      setItens(pedidoComItens.itens);
      setPedido(pedidoComItens.pedido);

      if (pedidoComItens.total !== pedidoComItens.pedido.total) {
        await atualizarPedido(pedidoId, { total: pedidoComItens.total });
        setPedido((prev) => (prev ? { ...prev, total: pedidoComItens.total } : prev));
      }
    } catch (err) {
      // 404 é um resultado esperado (pedido inexistente/removido), não uma
      // falha a reportar por toast — os demais erros (500, timeout, rede)
      // mantêm o tratamento existente. 401 nunca cai aqui como 404: o
      // interceptor de services/api.ts já trata sessão expirada à parte.
      if (isAxiosError(err) && err.response?.status === 404) {
        setPedidoNaoEncontrado(true);
      } else {
        const mensagem = getErrorMessage(err, "Não foi possível carregar o pedido.");
        toast.error(mensagem);
        setErro(mensagem);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarPedido();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  async function handleSubmit(data: ItemPedidoFormValues) {
    if (!editingItem) return;

    try {
      await atualizarItemPedido(editingItem.id, data);
      setShowForm(false);
      setEditingItem(undefined);
      toast.success("Item do pedido atualizado com sucesso.");
      await carregarPedido();
    } catch (err) {
      // getErrorMessage preserva mensagens específicas do backend (estoque
      // insuficiente, produto/pedido inexistente etc.) em vez de escondê-las.
      toast.error(getErrorMessage(err, "Não foi possível salvar o item."));
    }
  }

  function handleEdit(item: ItemPedido) {
    setEditingItem(item);
    setShowForm(true);
  }

  async function handleRemove(item: ItemPedido) {
    if (
      !window.confirm(
        "Remover este item do pedido? O estoque do produto será devolvido.",
      )
    ) {
      return;
    }

    try {
      await removerItemPedido(item.id);
      toast.success("Item removido do pedido com sucesso.");
      await carregarPedido();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível remover o item."));
    }
  }

  function handleCancel() {
    setShowForm(false);
    setEditingItem(undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link
          href={ROUTES.PEDIDOS}
          className="text-sm font-medium text-brand-navy hover:underline"
        >
          ← Voltar para pedidos
        </Link>
      </p>

      {pedidoNaoEncontrado ? (
        <EmptyState
          eyebrow="Erro"
          title="Pedido não encontrado"
          message="O pedido solicitado não existe ou não foi localizado."
        />
      ) : erro ? (
        <InlineErrorState message={erro} onRetry={carregarPedido} />
      ) : loading || !pedido ? (
        <TableSkeleton rows={3} columns={4} />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-brand-navy">
              Pedido {pedido.numero}
            </h2>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Badge tone={STATUS_TONE[pedido.status]}>{STATUS_LABEL[pedido.status]}</Badge>
              <span>Total: {pedido.total}</span>
            </div>
          </div>

          {showForm && editingItem && (
            <ItemPedidoForm
              produtos={produtos}
              initialData={editingItem}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          )}

          <ItemPedidoTable
            itens={itens}
            produtos={produtos}
            onEdit={handleEdit}
            onRemove={handleRemove}
          />
        </>
      )}
    </div>
  );
}
