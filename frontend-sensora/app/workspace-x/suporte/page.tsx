"use client";

// Solicitações de suporte (GET /admin/suporte). ADMIN-only: o backend
// responde 403 a qualquer outro perfil; o aviso abaixo é só a camada visual
// (mesmo padrão de /workspace-x/devolucoes e /workspace-x/ocorrencias). A
// resposta ao cliente é por e-mail, fora do painel.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/InlineErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import StatusSuporteBadge, { formatarDataSuporte } from "@/components/admin/StatusSuporteBadge";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import {
  PerfilUsuario,
  ROTULOS_CATEGORIA_SUPORTE,
  ROTULOS_STATUS_SUPORTE,
  type PaginaSolicitacoesSuporte,
} from "@/lib/types/loja";
import { listarSolicitacoesSuporte } from "@/services/suporte";

export default function SuporteAdminPage() {
  const router = useRouter();
  const { perfil } = useAuth();
  const [status, setStatus] = useState("");
  const [categoria, setCategoria] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaSolicitacoesSuporte | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Incrementado para tentar carregar de novo depois de um erro.
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (perfil !== PerfilUsuario.ADMIN) return;
    let ativo = true;
    listarSolicitacoesSuporte({ page: pagina, status, categoria })
      .then((resposta) => {
        if (!ativo) return;
        setDados(resposta);
        setErro(null);
      })
      .catch((err) => {
        if (ativo) setErro(getErrorMessage(err, "Não foi possível carregar as solicitações."));
      });
    return () => {
      ativo = false;
    };
  }, [perfil, status, categoria, pagina, tentativa]);

  // Trocar filtro ou página volta ao carregamento.
  function carregar(mudar: () => void) {
    setDados(null);
    mudar();
  }

  function handleTentarDeNovo() {
    setErro(null);
    setDados(null);
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
      <div>
        <h2 className="text-xl font-semibold text-brand-navy">Suporte</h2>
        <p className="text-sm text-slate-500">
          Solicitações abertas pelos clientes. A resposta é por e-mail.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-status-suporte" className="text-xs font-medium text-slate-500">
            Status
          </label>
          <select
            id="filtro-status-suporte"
            value={status}
            onChange={(event) =>
              carregar(() => {
                setStatus(event.target.value);
                setPagina(1);
              })
            }
            className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          >
            <option value="">Todos</option>
            {Object.entries(ROTULOS_STATUS_SUPORTE).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-categoria-suporte" className="text-xs font-medium text-slate-500">
            Categoria
          </label>
          <select
            id="filtro-categoria-suporte"
            value={categoria}
            onChange={(event) =>
              carregar(() => {
                setCategoria(event.target.value);
                setPagina(1);
              })
            }
            className="w-52 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          >
            <option value="">Todas</option>
            {Object.entries(ROTULOS_CATEGORIA_SUPORTE).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erro ? (
        <InlineErrorState message={erro} onRetry={handleTentarDeNovo} />
      ) : dados === null ? (
        <TableSkeleton rows={5} columns={6} />
      ) : dados.items.length === 0 ? (
        <EmptyState
          title="Nenhuma solicitação"
          message={
            status || categoria
              ? "Nenhuma solicitação com estes filtros."
              : "Ainda não há solicitações de suporte."
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Assunto</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dados.items.map((solicitacao) => (
                  // A linha inteira abre o detalhe. O link do assunto continua
                  // sendo o alvo de teclado e de Ctrl+clique (nova aba); um
                  // clique nele não navega duas vezes.
                  <tr
                    key={solicitacao.id}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("a")) return;
                      router.push(`${ROUTES.SUPORTE}/${solicitacao.id}`);
                    }}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="max-w-xs px-4 py-3">
                      <Link
                        href={`${ROUTES.SUPORTE}/${solicitacao.id}`}
                        className="block truncate font-medium text-brand-navy hover:underline"
                        title={solicitacao.assunto}
                      >
                        {solicitacao.assunto}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {ROTULOS_CATEGORIA_SUPORTE[solicitacao.categoria] ?? solicitacao.categoria}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{solicitacao.nome}</td>
                    <td className="px-4 py-3 text-slate-500">{solicitacao.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatarDataSuporte(solicitacao.criadaEm)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSuporteBadge status={solicitacao.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {dados.totalPages > 1 && (
            <nav
              aria-label="Paginação das solicitações"
              className="flex items-center justify-between text-sm text-slate-600"
            >
              <button
                type="button"
                disabled={pagina <= 1}
                onClick={() => carregar(() => setPagina((p) => p - 1))}
                className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
              >
                Anterior
              </button>
              <span>
                Página {dados.page} de {dados.totalPages} · {dados.total} solicitações
              </span>
              <button
                type="button"
                disabled={pagina >= dados.totalPages}
                onClick={() => carregar(() => setPagina((p) => p + 1))}
                className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
