"use client";

// Contas reais da loja (Usuario com perfil CLIENTE) — GET /usuarios/clientes.
// O CRUD legado em /clientes (model Cliente) não é usado aqui; pedidos e
// compras vêm sempre de Usuario -> Pedido.
import { useEffect, useMemo, useState } from "react";
import ClientesReaisTable from "@/components/admin/ClientesReaisTable";
import TableSkeleton from "@/components/ui/TableSkeleton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { listarClientesReais } from "@/services/usuarios";
import type { ClienteListagem } from "@/lib/types/loja";

export default function ClientesPage() {
  const toast = useToast();
  const [clientes, setClientes] = useState<ClienteListagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  async function carregarClientes() {
    setLoading(true);
    setErro(null);
    try {
      setClientes(await listarClientesReais());
    } catch (err) {
      const mensagem = getErrorMessage(err, "Não foi possível carregar os clientes.");
      toast.error(mensagem);
      setErro(mensagem);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarClientes();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        c.email.toLowerCase().includes(termo) ||
        (c.cpf ?? "").includes(termo.replace(/\D/g, "")),
    );
  }, [busca, clientes]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-brand-navy">Clientes</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Contas criadas na loja, pedidos e produtos comprados (somente pedidos pagos
            entram no total e na lista de produtos).
          </p>
        </div>
        <label className="flex w-full max-w-sm flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Buscar</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, e-mail ou CPF"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </label>
      </div>

      {loading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : erro ? (
        <InlineErrorState message={erro} onRetry={carregarClientes} />
      ) : (
        <ClientesReaisTable clientes={clientesFiltrados} />
      )}
    </div>
  );
}
