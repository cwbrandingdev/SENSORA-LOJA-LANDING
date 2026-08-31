"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import ItemPedidoTable, {
  ItemPedidoTableSkeleton,
} from "@/components/tables/ItemPedidoTable";
import { PedidoStatusBadge } from "@/components/tables/PedidoTable";
import ItemPedidoForm from "@/components/forms/ItemPedidoForm";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormButton from "@/components/ui/FormButton";
import Skeleton from "@/components/ui/Skeleton";
import { formatBRL } from "@/lib/format";
import { buscarPedidoComItens, atualizarPedido } from "@/services/pedidos";
import {
  criarItemPedido,
  atualizarItemPedido,
  removerItemPedido,
} from "@/services/itensPedido";
import { listarProdutos } from "@/services/produtos";
import { ROUTES } from "@/lib/routes";
import type { Pedido, ItemPedido, Produto, PedidoComItens } from "@/lib/types";

export default function PedidoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingItem, setEditingItem] = useState<ItemPedido | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ItemPedido | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregarPedido() {
    setLoading(true);
    setLoadError("");
    try {
      const [pedidoComItens, listaProdutos] = await Promise.all([
        buscarPedidoComItens(pedidoId) as Promise<PedidoComItens>,
        listarProdutos() as Promise<Produto[]>,
      ]);

      setProdutos(listaProdutos);
      setItens(pedidoComItens.itens);
      setPedido(pedidoComItens.pedido);

      if (pedidoComItens.total !== pedidoComItens.pedido.total) {
        await atualizarPedido(pedidoId, { total: pedidoComItens.total });
        setPedido((prev) =>
          prev ? { ...prev, total: pedidoComItens.total } : prev,
        );
      }
    } catch {
      setLoadError("Não foi possível carregar o pedido.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarPedido();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  async function handleSubmit(data: Partial<ItemPedido>) {
    try {
      if (editingItem) {
        await atualizarItemPedido(editingItem.id, data);
        toast.success("Item atualizado com sucesso.");
      } else {
        await criarItemPedido({ ...data, pedidoId });
        toast.success("Item adicionado com sucesso.");
      }
      setDialogOpen(false);
      setEditingItem(null);
      await carregarPedido();
    } catch {
      toast.error(
        "Não foi possível salvar o item. Verifique o estoque disponível.",
      );
    }
  }

  function handleEdit(item: ItemPedido) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  function handleNovoItem() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditingItem(null);
    }
  }

  async function handleConfirmRemove() {
    if (!itemToDelete) return;

    setDeleting(true);
    try {
      await removerItemPedido(itemToDelete.id);
      toast.success("Item excluído com sucesso.");
      setItemToDelete(null);
      await carregarPedido();
    } catch {
      // Mantém o diálogo aberto em caso de erro, para o usuário tentar
      // novamente ou cancelar — só fecha automaticamente no sucesso.
      toast.error("Não foi possível excluir o item.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="motion-safe:animate-[fade-in-up_250ms_ease-out] flex flex-col gap-5">
      <Link
        href={ROUTES.PEDIDOS}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-navy transition-colors hover:text-brand-navy-light"
      >
        <ArrowLeft size={16} />
        Voltar para pedidos
      </Link>

      {loadError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {loading || !pedido ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
          <ItemPedidoTableSkeleton />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-brand-navy">
                Pedido {pedido.numero}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <PedidoStatusBadge status={pedido.status} />
                <span className="text-slate-300">·</span>
                <span>{new Date(pedido.data).toLocaleDateString("pt-BR")}</span>
                <span className="text-slate-300">·</span>
                <span className="font-medium text-slate-900">
                  Total: {formatBRL(pedido.total)}
                </span>
              </div>
            </div>
            <FormButton
              variant="primary"
              onClick={handleNovoItem}
              className="w-fit active:scale-[0.98]"
            >
              + Adicionar item
            </FormButton>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Itens do pedido
            </h3>
            <ItemPedidoTable
              itens={itens}
              produtos={produtos}
              onEdit={handleEdit}
              onRemove={setItemToDelete}
              onCreate={handleNovoItem}
            />
          </div>
        </>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        title={editingItem ? "Editar item" : "Adicionar item"}
        description={
          editingItem
            ? "Atualize os dados do item deste pedido."
            : "Selecione um produto para adicionar a este pedido."
        }
      >
        <ItemPedidoForm
          produtos={produtos}
          initialData={editingItem}
          onSubmit={handleSubmit}
          onCancel={() => handleDialogOpenChange(false)}
        />
      </Dialog>

      <ConfirmDialog
        open={Boolean(itemToDelete)}
        onOpenChange={(open: boolean) => {
          if (!open) setItemToDelete(null);
        }}
        title="Remover item?"
        description="Remover este item do pedido? O estoque do produto será devolvido. Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        onConfirm={handleConfirmRemove}
        loading={deleting}
      />
    </div>
  );
}
