"use client";

import { useEffect, useState } from "react";
import PedidoTable from "@/components/tables/PedidoTable";
import PedidoForm, { type PedidoFormValues } from "@/components/forms/PedidoForm";
import FormButton from "@/components/ui/FormButton";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  listarPedidos,
  criarPedido,
  atualizarPedido,
  removerPedido,
} from "@/services/pedidos";
import type { Pedido } from "@/lib/types/loja";

export default function PedidosPage() {
  const toast = useToast();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPedido, setEditingPedido] = useState<Pedido | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  async function carregarPedidos() {
    setLoading(true);
    try {
      const data = await listarPedidos();
      setPedidos(data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível carregar os pedidos."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarPedidos();
  }, []);

  async function handleSubmit(data: PedidoFormValues) {
    const editando = Boolean(editingPedido);
    try {
      if (editingPedido) {
        await atualizarPedido(editingPedido.id, data);
      } else {
        await criarPedido({ ...data, total: 0 });
      }
      setShowForm(false);
      setEditingPedido(undefined);
      toast.success(
        editando ? "Status do pedido atualizado com sucesso." : "Pedido criado com sucesso.",
      );
      await carregarPedidos();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar o pedido."));
    }
  }

  function handleEdit(pedido: Pedido) {
    setEditingPedido(pedido);
    setShowForm(true);
  }

  async function handleRemove(pedido: Pedido) {
    if (
      !window.confirm(
        `Remover o pedido "${pedido.numero}"? Os itens deste pedido serão excluídos e o estoque consumido por eles NÃO será devolvido automaticamente.`,
      )
    ) {
      return;
    }

    try {
      await removerPedido(pedido.id);
      toast.success("Pedido excluído com sucesso.");
      await carregarPedidos();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível remover o pedido."));
    }
  }

  function handleNovoPedido() {
    setEditingPedido(undefined);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingPedido(undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-brand-navy">Pedidos</h2>
        <FormButton variant="primary" onClick={handleNovoPedido}>
          Novo pedido
        </FormButton>
      </div>

      {showForm && (
        <PedidoForm
          initialData={editingPedido}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando pedidos...</p>
      ) : (
        <PedidoTable pedidos={pedidos} onEdit={handleEdit} onRemove={handleRemove} />
      )}
    </div>
  );
}
