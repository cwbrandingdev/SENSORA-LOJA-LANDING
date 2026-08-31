"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import ClientTable, {
  ClientTableSkeleton,
} from "@/components/tables/ClientTable";
import ClientForm from "@/components/forms/ClientForm";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormButton from "@/components/ui/FormButton";
import {
  listarClientes,
  criarCliente,
  atualizarCliente,
  removerCliente,
} from "@/services/clientes";
import type { Cliente } from "@/lib/types";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregarClientes() {
    setLoading(true);
    setLoadError("");
    try {
      const data: Cliente[] = await listarClientes();
      setClientes(data);
    } catch {
      setLoadError("Não foi possível carregar os clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarClientes();
  }, []);

  async function handleSubmit(data: Partial<Cliente>) {
    try {
      if (editingClient) {
        await atualizarCliente(editingClient.id, data);
        toast.success("Cliente atualizado com sucesso.");
      } else {
        await criarCliente(data);
        toast.success("Cliente criado com sucesso.");
      }
      setDialogOpen(false);
      setEditingClient(null);
      await carregarClientes();
    } catch {
      toast.error(
        editingClient
          ? "Não foi possível atualizar o cliente."
          : "Não foi possível criar o cliente.",
      );
    }
  }

  function handleEdit(cliente: Cliente) {
    setEditingClient(cliente);
    setDialogOpen(true);
  }

  function handleNovoCliente() {
    setEditingClient(null);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditingClient(null);
    }
  }

  async function handleConfirmRemove() {
    if (!clienteToDelete) return;

    setDeleting(true);
    try {
      await removerCliente(clienteToDelete.id);
      toast.success("Cliente excluído com sucesso.");
      setClienteToDelete(null);
      await carregarClientes();
    } catch {
      // Mantém o diálogo aberto em caso de erro, para o usuário tentar
      // novamente ou cancelar — só fecha automaticamente no sucesso.
      toast.error("Não foi possível excluir o cliente.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="motion-safe:animate-[fade-in-up_250ms_ease-out] flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-brand-navy">Clientes</h2>
          <p className="text-sm text-slate-500">
            Consulte e gerencie os clientes cadastrados na loja.
          </p>
        </div>
        <FormButton
          variant="primary"
          onClick={handleNovoCliente}
          className="w-fit active:scale-[0.98]"
        >
          + Novo cliente
        </FormButton>
      </div>

      {loadError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {loading ? (
        <ClientTableSkeleton />
      ) : (
        <ClientTable
          clientes={clientes}
          onEdit={handleEdit}
          onRemove={setClienteToDelete}
          onCreate={handleNovoCliente}
        />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        title={editingClient ? "Editar cliente" : "Novo cliente"}
        description={
          editingClient
            ? "Atualize as informações do cliente."
            : "Preencha os dados para cadastrar um novo cliente."
        }
      >
        <ClientForm
          initialData={editingClient}
          onSubmit={handleSubmit}
          onCancel={() => handleDialogOpenChange(false)}
        />
      </Dialog>

      <ConfirmDialog
        open={Boolean(clienteToDelete)}
        onOpenChange={(open: boolean) => {
          if (!open) setClienteToDelete(null);
        }}
        title="Excluir cliente?"
        description={
          clienteToDelete
            ? `Tem certeza que deseja excluir o cliente "${clienteToDelete.nome}"? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        onConfirm={handleConfirmRemove}
        loading={deleting}
      />
    </div>
  );
}
