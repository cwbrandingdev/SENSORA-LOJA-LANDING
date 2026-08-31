"use client";

import { useEffect, useState } from "react";
import ClientTable from "@/components/tables/ClientTable";
import ClientForm, { type ClientFormValues } from "@/components/forms/ClientForm";
import FormButton from "@/components/ui/FormButton";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  listarClientes,
  criarCliente,
  atualizarCliente,
  removerCliente,
} from "@/services/clientes";
import type { Cliente } from "@/lib/types/loja";

export default function ClientesPage() {
  const toast = useToast();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<Cliente | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  async function carregarClientes() {
    setLoading(true);
    try {
      const data = await listarClientes();
      setClientes(data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível carregar os clientes."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarClientes();
  }, []);

  async function handleSubmit(data: ClientFormValues) {
    const editando = Boolean(editingClient);
    try {
      if (editingClient) {
        await atualizarCliente(editingClient.id, data);
      } else {
        await criarCliente(data);
      }
      setShowForm(false);
      setEditingClient(undefined);
      toast.success(editando ? "Cliente atualizado com sucesso." : "Cliente criado com sucesso.");
      await carregarClientes();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar o cliente."));
    }
  }

  function handleEdit(cliente: Cliente) {
    setEditingClient(cliente);
    setShowForm(true);
  }

  async function handleRemove(cliente: Cliente) {
    if (!window.confirm(`Remover o cliente "${cliente.nome}"?`)) {
      return;
    }

    try {
      await removerCliente(cliente.id);
      toast.success("Cliente excluído com sucesso.");
      await carregarClientes();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível remover o cliente."));
    }
  }

  function handleNovoCliente() {
    setEditingClient(undefined);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingClient(undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-brand-navy">Clientes</h2>
        <FormButton variant="primary" onClick={handleNovoCliente}>
          Novo cliente
        </FormButton>
      </div>

      {showForm && (
        <ClientForm
          initialData={editingClient}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando clientes...</p>
      ) : (
        <ClientTable clientes={clientes} onEdit={handleEdit} onRemove={handleRemove} />
      )}
    </div>
  );
}
