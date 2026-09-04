"use client";

// Etapa 8.1 (complemento — eliminação da venda manual) — esta página não
// cria mais pedidos. "Novo pedido" foi removido de propósito: a Sensora não
// tem venda manual, então a área administrativa só gerencia pedidos que já
// nasceram do fluxo real (Carrinho -> Checkout -> Asaas). O que resta aqui é
// só edição de numero/data/total, remoção, marcar como enviado e listagem —
// nunca criação de venda.
import { useEffect, useState } from "react";
import PedidoTable from "@/components/tables/PedidoTable";
import PedidoForm, { type PedidoFormValues } from "@/components/forms/PedidoForm";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  listarPedidos,
  atualizarPedido,
  removerPedido,
  marcarPedidoComoEnviado,
} from "@/services/pedidos";
import type { Pedido } from "@/lib/types/loja";

export default function PedidosPage() {
  const toast = useToast();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPedido, setEditingPedido] = useState<Pedido | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  // Etapa 6.6 (Status de Envio) — id do pedido com a ação "Marcar como
  // enviado" em andamento: desabilita só o botão daquela linha (não a
  // tabela inteira) e evita clique duplicado disparando duas chamadas.
  const [marcandoEnviadoId, setMarcandoEnviadoId] = useState<number | null>(null);

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
    if (!editingPedido) return;

    try {
      await atualizarPedido(editingPedido.id, data);
      setShowForm(false);
      setEditingPedido(undefined);
      toast.success("Pedido atualizado com sucesso.");
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
    // Etapa 8.2 (HIGH-02) — texto atualizado: o botão só aparece para
    // pedidos PENDENTE (ver PedidoTable.tsx), e um pedido PENDENTE nunca
    // tem estoque consumido (só CheckoutService.confirmarPagamento()
    // decrementa estoque, e isso sempre acontece junto com a transição
    // para PAGO) — o aviso anterior sobre "estoque não devolvido" não fazia
    // mais sentido depois da correção do HIGH-02, e foi removido.
    if (
      !window.confirm(
        `Remover o pedido "${pedido.numero}"? Esta ação não pode ser desfeita.`,
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

  function handleCancel() {
    setShowForm(false);
    setEditingPedido(undefined);
  }

  // Etapa 6.6 (Status de Envio) — ação simples (não destrutiva, reversível
  // em espírito), mesmo padrão de confirmação já usado por handleRemove
  // nesta página (window.confirm nativo) em vez do ConfirmDialog mais
  // pesado reservado hoje só para as ações de Minha Conta (cancelar/
  // solicitar reembolso) — evita disparo acidental sem introduzir um
  // padrão de UI novo nesta tela.
  async function handleMarcarEnviado(pedido: Pedido) {
    if (marcandoEnviadoId !== null) return;

    if (!window.confirm(`Marcar o pedido "${pedido.numero}" como enviado?`)) {
      return;
    }

    setMarcandoEnviadoId(pedido.id);
    try {
      await marcarPedidoComoEnviado(pedido.id);
      toast.success("Pedido marcado como enviado.");
      await carregarPedidos();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível marcar o pedido como enviado."));
    } finally {
      setMarcandoEnviadoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-brand-navy">Pedidos</h2>
      </div>

      {showForm && editingPedido && (
        <PedidoForm
          initialData={editingPedido}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando pedidos...</p>
      ) : (
        <PedidoTable
          pedidos={pedidos}
          onEdit={handleEdit}
          onRemove={handleRemove}
          onMarcarEnviado={handleMarcarEnviado}
          marcandoEnviadoId={marcandoEnviadoId}
        />
      )}
    </div>
  );
}
