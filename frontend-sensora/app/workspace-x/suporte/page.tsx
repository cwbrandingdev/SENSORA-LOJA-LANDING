"use client";

// Solicitações de suporte (GET /admin/suporte). ADMIN-only: o backend
// responde 403 a qualquer outro perfil; o aviso abaixo é só a camada visual
// (mesmo padrão de /workspace-x/devolucoes e /workspace-x/ocorrencias). A
// resposta ao cliente é por e-mail, fora do painel.
import { useEffect, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/InlineErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import SuporteQuadro from "@/components/admin/SuporteQuadro";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/errors";
import { PerfilUsuario, type PaginaSolicitacoesSuporte } from "@/lib/types/loja";
import { listarSolicitacoesSuporte } from "@/services/suporte";

export default function SuporteAdminPage() {
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

      <SuporteQuadro
        itens={dados?.items ?? []}
        estado={
          erro ? (
            <InlineErrorState message={erro} onRetry={handleTentarDeNovo} />
          ) : dados === null ? (
            <TableSkeleton rows={5} columns={3} />
          ) : dados.items.length === 0 ? (
            <EmptyState
              title="Nenhuma solicitação"
              message={
                status || categoria
                  ? "Nenhuma solicitação com estes filtros."
                  : "Ainda não há solicitações de suporte."
              }
            />
          ) : null
        }
        paginacao={
          dados && dados.totalPages > 1 ? (
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
          ) : null
        }
        status={status}
        categoria={categoria}
        onStatus={(valor) =>
          carregar(() => {
            setStatus(valor);
            setPagina(1);
          })
        }
        onCategoria={(valor) =>
          carregar(() => {
            setCategoria(valor);
            setPagina(1);
          })
        }
      />
    </div>
  );
}
