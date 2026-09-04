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
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { buscarPedidoComItens, atualizarPedido } from "@/services/pedidos";
import { atualizarItemPedido, removerItemPedido } from "@/services/itensPedido";
import { listarProdutos } from "@/services/produtos";
import { ROUTES } from "@/lib/routes";
import type { Pedido, ItemPedido, Produto } from "@/lib/types/loja";

export default function PedidoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);
  const toast = useToast();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pedidoNaoEncontrado, setPedidoNaoEncontrado] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemPedido | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  async function carregarPedido() {
    setLoading(true);
    setPedidoNaoEncontrado(false);

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
        toast.error(getErrorMessage(err, "Não foi possível carregar o pedido."));
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
      ) : loading || !pedido ? (
        <p className="text-sm text-slate-500">Carregando pedido...</p>
      ) : (
        <>
          <div>
            <h2 className="text-xl font-semibold text-brand-navy">
              Pedido {pedido.numero}
            </h2>
            <p className="text-sm text-slate-600">
              Status: {pedido.status} · Total: {pedido.total}
            </p>
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
