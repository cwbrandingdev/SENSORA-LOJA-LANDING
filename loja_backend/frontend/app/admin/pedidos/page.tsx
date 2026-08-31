"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import PedidoTable, {
  PedidoTableSkeleton,
} from "@/components/tables/PedidoTable";
import PedidoForm from "@/components/forms/PedidoForm";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormButton from "@/components/ui/FormButton";
import {
  listarPedidos,
  criarPedido,
  atualizarPedido,
  removerPedido,
} from "@/services/pedidos";
import type { Pedido } from "@/lib/types";

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pedidoToDelete, setPedidoToDelete] = useState<Pedido | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregarPedidos() {
    setLoading(true);
    setLoadError("");
    try {
      const data: Pedido[] = await listarPedidos();
      setPedidos(data);
    } catch {
      setLoadError("Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarPedidos();
  }, []);

  async function handleSubmit(data: Partial<Pedido>) {
    try {
      if (editingPedido) {
        await atualizarPedido(editingPedido.id, data);
        toast.success("Pedido atualizado com sucesso.");
      } else {
        await criarPedido({ ...data, total: 0 });
        toast.success("Pedido criado com sucesso.");
      }
      setDialogOpen(false);
      setEditingPedido(null);
      await carregarPedidos();
    } catch {
      toast.error(
        editingPedido
          ? "Não foi possível atualizar o pedido."
          : "Não foi possível criar o pedido.",
      );
    }
  }

  function handleEdit(pedido: Pedido) {
    setEditingPedido(pedido);
    setDialogOpen(true);
  }

  function handleNovoPedido() {
    setEditingPedido(null);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditingPedido(null);
    }
  }

  async function handleConfirmRemove() {
    if (!pedidoToDelete) return;

    setDeleting(true);
    try {
      await removerPedido(pedidoToDelete.id);
      toast.success("Pedido excluído com sucesso.");
      setPedidoToDelete(null);
      await carregarPedidos();
    } catch {
      // Mantém o diálogo aberto em caso de erro, para o usuário tentar
      // novamente ou cancelar — só fecha automaticamente no sucesso.
      toast.error("Não foi possível excluir o pedido.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="motion-safe:animate-[fade-in-up_250ms_ease-out] flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-brand-navy">Pedidos</h2>
          <p className="text-sm text-slate-500">
            Acompanhe os pedidos da loja e seus status.
          </p>
        </div>
        <FormButton
          variant="primary"
          onClick={handleNovoPedido}
          className="w-fit active:scale-[0.98]"
        >
          + Novo pedido
        </FormButton>
      </div>

      {loadError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {loading ? (
        <PedidoTableSkeleton />
      ) : (
        <PedidoTable
          pedidos={pedidos}
          onEdit={handleEdit}
          onRemove={setPedidoToDelete}
          onCreate={handleNovoPedido}
        />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        title={editingPedido ? "Editar pedido" : "Novo pedido"}
        description={
          editingPedido
            ? "Atualize as informações do pedido."
            : "Preencha os dados para cadastrar um novo pedido."
        }
      >
        <PedidoForm
          initialData={editingPedido}
          onSubmit={handleSubmit}
          onCancel={() => handleDialogOpenChange(false)}
        />
      </Dialog>

      <ConfirmDialog
        open={Boolean(pedidoToDelete)}
        onOpenChange={(open: boolean) => {
          if (!open) setPedidoToDelete(null);
        }}
        title="Excluir pedido?"
        description={
          pedidoToDelete
            ? `Tem certeza que deseja excluir o pedido "${pedidoToDelete.numero}"? Os itens deste pedido serão excluídos e o estoque consumido por eles não será devolvido automaticamente.`
            : undefined
        }
        confirmLabel="Excluir"
        onConfirm={handleConfirmRemove}
        loading={deleting}
      />
    </div>
  );
}
