"use client";

// Etapa 7 — fila das devoluções para análise (GET /admin/devolucoes).
// ADMIN-only: o backend responde 403 a qualquer outro perfil; o aviso
// abaixo é só a camada visual (mesmo padrão de /workspace-x/usuarios).
import { useEffect, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/InlineErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/errors";
import {
  PerfilUsuario,
  ROTULOS_STATUS_DEVOLUCAO,
  type DevolucaoResumoAdmin,
} from "@/lib/types/loja";
import { listarDevolucoesAdmin } from "@/services/devolucoes";
import DevolucoesFila from "@/components/admin/DevolucoesFila";

export default function DevolucoesAdminPage() {
  const { perfil } = useAuth();
  const [status, setStatus] = useState("");
  const [devolucoes, setDevolucoes] = useState<DevolucaoResumoAdmin[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Incrementado para tentar carregar de novo depois de um erro.
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (perfil !== PerfilUsuario.ADMIN) return;
    let ativo = true;
    listarDevolucoesAdmin(status || undefined)
      .then((lista) => {
        if (!ativo) return;
        setDevolucoes(lista);
        setErro(null);
      })
      .catch((err) => {
        if (ativo) setErro(getErrorMessage(err, "Não foi possível carregar as devoluções."));
      });
    return () => {
      ativo = false;
    };
  }, [perfil, status, tentativa]);

  function handleFiltrar(novoStatus: string) {
    setDevolucoes(null);
    setStatus(novoStatus);
  }

  function handleTentarDeNovo() {
    setErro(null);
    setDevolucoes(null);
    setTentativa((n) => n + 1);
  }

  if (perfil !== PerfilUsuario.ADMIN) {
    return (
      <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        Acesso restrito a administradores.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-brand-navy">Devoluções</h2>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-status-devolucao" className="text-xs font-medium text-slate-500">
            Status
          </label>
          <select
            id="filtro-status-devolucao"
            value={status}
            onChange={(event) => handleFiltrar(event.target.value)}
            className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          >
            <option value="">Todos</option>
            {Object.entries(ROTULOS_STATUS_DEVOLUCAO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erro ? (
        <InlineErrorState message={erro} onRetry={handleTentarDeNovo} />
      ) : devolucoes === null ? (
        <TableSkeleton rows={5} columns={4} />
      ) : devolucoes.length === 0 ? (
        <EmptyState
          title="Nenhuma devolução"
          message={
            status
              ? "Nenhuma devolução com este status."
              : "Ainda não há devoluções solicitadas."
          }
        />
      ) : (
        <DevolucoesFila devolucoes={devolucoes} />
      )}
    </div>
  );
}
