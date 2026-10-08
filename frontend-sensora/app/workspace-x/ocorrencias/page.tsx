"use client";

// Ocorrências de negócio (GET /admin/ocorrencias): o que aconteceu em
// reembolsos e devoluções, e por quê. ADMIN-only: o backend responde 403 a
// qualquer outro perfil; o aviso abaixo é só a camada visual (mesmo padrão
// de /workspace-x/devolucoes). O backend guarda só os últimos 30 dias.
import { useEffect, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/InlineErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/errors";
import {
  PerfilUsuario,
  ROTULOS_RESULTADO_OCORRENCIA,
  ROTULOS_TIPO_OCORRENCIA,
  type PaginaOcorrencias,
} from "@/lib/types/loja";
import { listarOcorrencias } from "@/services/ocorrencias";
import OcorrenciasQuadro from "@/components/admin/OcorrenciasQuadro";

function Filtro({
  id,
  rotulo,
  valor,
  opcoes,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  opcoes: Record<string, string>;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-500">
        {rotulo}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        className="w-44 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
      >
        <option value="">Todos</option>
        {Object.entries(opcoes).map(([chave, texto]) => (
          <option key={chave} value={chave}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function OcorrenciasAdminPage() {
  const { perfil } = useAuth();
  const [tipo, setTipo] = useState("");
  const [resultado, setResultado] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaOcorrencias | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Incrementado para tentar carregar de novo depois de um erro.
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (perfil !== PerfilUsuario.ADMIN) return;
    let ativo = true;
    listarOcorrencias({ page: pagina, tipo, resultado })
      .then((resposta) => {
        if (!ativo) return;
        setDados(resposta);
        setErro(null);
      })
      .catch((err) => {
        if (ativo) setErro(getErrorMessage(err, "Não foi possível carregar as ocorrências."));
      });
    return () => {
      ativo = false;
    };
  }, [perfil, tipo, resultado, pagina, tentativa]);

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

  const filtrando = Boolean(tipo || resultado);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-brand-navy">Ocorrências</h2>
        <p className="text-sm text-slate-500">
          O que aconteceu em reembolsos e devoluções nos últimos 30 dias.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <Filtro
          id="filtro-tipo-ocorrencia"
          rotulo="Tipo"
          valor={tipo}
          opcoes={ROTULOS_TIPO_OCORRENCIA}
          onChange={(valor) =>
            carregar(() => {
              setTipo(valor);
              setPagina(1);
            })
          }
        />
        <Filtro
          id="filtro-resultado-ocorrencia"
          rotulo="Resultado"
          valor={resultado}
          opcoes={ROTULOS_RESULTADO_OCORRENCIA}
          onChange={(valor) =>
            carregar(() => {
              setResultado(valor);
              setPagina(1);
            })
          }
        />
      </div>

      {erro ? (
        <InlineErrorState message={erro} onRetry={handleTentarDeNovo} />
      ) : dados === null ? (
        <TableSkeleton rows={5} columns={3} />
      ) : dados.items.length === 0 ? (
        <EmptyState
          title="Nenhuma ocorrência"
          message={
            filtrando
              ? "Nenhuma ocorrência com estes filtros nos últimos 30 dias."
              : "Nada registrado nos últimos 30 dias."
          }
        />
      ) : (
        <>
          <OcorrenciasQuadro ocorrencias={dados.items} />

          {dados.totalPages > 1 && (
            <nav
              aria-label="Paginação das ocorrências"
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
                Página {dados.page} de {dados.totalPages} · {dados.total} ocorrências
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
