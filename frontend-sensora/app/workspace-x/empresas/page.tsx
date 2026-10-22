"use client";

// Pedidos de proposta da página "Para empresas" (GET /admin/propostas-
// empresas). ADMIN-only: o backend responde 403 a outros perfis; o aviso
// abaixo é só a camada visual (mesmo padrão de /workspace-x/avaliacoes). A
// conversa com a empresa acontece por e-mail/telefone, fora daqui: o painel
// só acompanha a situação.
import { useEffect, useState } from "react";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/InlineErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import type { PropostaEmpresa, StatusPropostaEmpresa } from "@/lib/propostas-empresas";
import { formatarTelefone } from "@/lib/telefone";
import { PerfilUsuario } from "@/lib/types/loja";
import { atualizarStatusProposta, listarPropostasEmpresas } from "@/services/propostas-empresas";

const SITUACOES: { status: StatusPropostaEmpresa; rotulo: string; tom: BadgeTone }[] = [
  { status: "NOVA", rotulo: "Nova", tom: "warning" },
  { status: "EM_CONTATO", rotulo: "Em contato", tom: "info" },
  { status: "ENCERRADA", rotulo: "Encerrada", tom: "neutral" },
];

const formatarData = (data: string) =>
  new Date(data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default function EmpresasAdminPage() {
  const { perfil } = useAuth();
  const toast = useToast();
  const [itens, setItens] = useState<PropostaEmpresa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  useEffect(() => {
    if (perfil !== PerfilUsuario.ADMIN) return;
    let ativo = true;
    listarPropostasEmpresas()
      .then((lista) => {
        if (!ativo) return;
        setItens(lista);
        setErro(null);
      })
      .catch((err) => {
        if (ativo) setErro(getErrorMessage(err, "Não foi possível carregar as propostas."));
      });
    return () => {
      ativo = false;
    };
  }, [perfil, tentativa]);

  async function mudarStatus(proposta: PropostaEmpresa, status: StatusPropostaEmpresa) {
    setSalvandoId(proposta.id);
    try {
      const atualizada = await atualizarStatusProposta(proposta.id, status);
      setItens((atual) => (atual ?? []).map((p) => (p.id === atualizada.id ? atualizada : p)));
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível atualizar a proposta."));
    } finally {
      setSalvandoId(null);
    }
  }

  if (perfil !== PerfilUsuario.ADMIN) {
    return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Acesso restrito a administradores.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-brand-navy">Empresas</h2>
        <p className="text-sm text-slate-500">
          Pedidos de proposta enviados pela página &quot;Para empresas&quot;. A equipe também recebe cada um por e-mail.
        </p>
      </div>

      {erro ? (
        <InlineErrorState
          message={erro}
          onRetry={() => {
            setErro(null);
            setItens(null);
            setTentativa((n) => n + 1);
          }}
        />
      ) : itens === null ? (
        <TableSkeleton rows={4} columns={3} />
      ) : itens.length === 0 ? (
        <EmptyState title="Nenhuma proposta" message="Os pedidos enviados pela página Para empresas aparecem aqui." />
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((proposta) => {
            const situacao = SITUACOES.find((s) => s.status === proposta.status) ?? SITUACOES[0];
            return (
              <li key={proposta.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-navy">{proposta.empresa}</p>
                    <p className="text-sm text-slate-600">
                      {proposta.nome} · {proposta.cargo}
                    </p>
                  </div>
                  <Badge tone={situacao.tom}>{situacao.rotulo}</Badge>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="inline text-slate-500">E-mail: </dt>
                    <dd className="inline">
                      <a href={`mailto:${proposta.email}`} className="text-brand-navy underline underline-offset-2">
                        {proposta.email}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Telefone: </dt>
                    <dd className="inline text-brand-navy">{formatarTelefone(proposta.telefone)}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Objetivo: </dt>
                    <dd className="inline text-brand-navy">{proposta.objetivo}</dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">Quantidade: </dt>
                    <dd className="inline text-brand-navy">{proposta.quantidade}</dd>
                  </div>
                </dl>

                {proposta.mensagem && (
                  <p className="mt-3 whitespace-pre-line break-words rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                    {proposta.mensagem}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-500">Recebida em {formatarData(proposta.criadaEm)}</p>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    Situação
                    <select
                      value={proposta.status}
                      disabled={salvandoId === proposta.id}
                      onChange={(e) => mudarStatus(proposta, e.target.value as StatusPropostaEmpresa)}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-navy focus:outline-none"
                    >
                      {SITUACOES.map((s) => (
                        <option key={s.status} value={s.status}>
                          {s.rotulo}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
