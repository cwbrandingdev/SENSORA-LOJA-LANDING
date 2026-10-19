"use client";

// Moderação das avaliações de produto (GET /admin/avaliacoes). ADMIN-only:
// o backend responde 403 a qualquer outro perfil; o aviso abaixo é só a
// camada visual (mesmo padrão de /workspace-x/suporte). Avaliação aprovada
// aparece na página do produto (e nos dados para o Google).
import { useEffect, useState } from "react";
import Link from "next/link";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FormButton from "@/components/ui/FormButton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import Estrelas from "@/components/loja/Estrelas";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { revalidarAvaliacoes } from "@/lib/actions";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import { getErrorMessage } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import { PerfilUsuario, type AvaliacaoAdmin, type StatusAvaliacao } from "@/lib/types/loja";
import { atualizarStatusAvaliacao, listarAvaliacoesAdmin } from "@/services/avaliacoes";

const ABAS: { status: StatusAvaliacao; rotulo: string }[] = [
  { status: "PENDENTE", rotulo: "Aguardando aprovação" },
  { status: "APROVADA", rotulo: "Aprovadas" },
  { status: "RECUSADA", rotulo: "Recusadas" },
];

const TOM: Record<StatusAvaliacao, BadgeTone> = { PENDENTE: "warning", APROVADA: "success", RECUSADA: "neutral" };
const ROTULO: Record<StatusAvaliacao, string> = { PENDENTE: "Pendente", APROVADA: "Aprovada", RECUSADA: "Recusada" };

const formatarData = (data: string) =>
  new Date(data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default function AvaliacoesAdminPage() {
  const { perfil } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<StatusAvaliacao>("PENDENTE");
  const [itens, setItens] = useState<AvaliacaoAdmin[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  useEffect(() => {
    if (perfil !== PerfilUsuario.ADMIN) return;
    let ativo = true;
    listarAvaliacoesAdmin(status)
      .then((lista) => {
        if (!ativo) return;
        setItens(lista);
        setErro(null);
      })
      .catch((err) => {
        if (ativo) setErro(getErrorMessage(err, "Não foi possível carregar as avaliações."));
      });
    return () => {
      ativo = false;
    };
  }, [perfil, status, tentativa]);

  async function decidir(avaliacao: AvaliacaoAdmin, novo: Exclude<StatusAvaliacao, "PENDENTE">) {
    setSalvandoId(avaliacao.id);
    try {
      await atualizarStatusAvaliacao(avaliacao.id, novo);
      await revalidarAvaliacoes();
      // Sai da aba atual (a lista é filtrada por situação).
      setItens((atual) => (atual ?? []).filter((a) => a.id !== avaliacao.id));
      toast.success(novo === "APROVADA" ? "Avaliação publicada na loja." : "Avaliação recusada.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível atualizar a avaliação."));
    } finally {
      setSalvandoId(null);
    }
  }

  if (perfil !== PerfilUsuario.ADMIN) {
    return (
      <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Acesso restrito a administradores.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-brand-navy">Avaliações</h2>
        <p className="text-sm text-slate-500">
          Avaliações de clientes que compraram e confirmaram o recebimento. Só as aprovadas aparecem na loja.
        </p>
      </div>

      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Aprove também as avaliações negativas</strong> quando forem honestas. Recuse só spam, ofensas, dados
        pessoais ou textos que não falam do produto — o Google pune lojas que publicam apenas as avaliações boas.
      </p>

      <div role="tablist" aria-label="Situação das avaliações" className="flex flex-wrap gap-2">
        {ABAS.map((aba) => (
          <button
            key={aba.status}
            type="button"
            role="tab"
            aria-selected={status === aba.status}
            onClick={() => {
              setItens(null);
              setStatus(aba.status);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              status === aba.status
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-slate-300 text-slate-600 hover:border-brand-navy hover:text-brand-navy"
            }`}
          >
            {aba.rotulo}
          </button>
        ))}
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
        <EmptyState
          title="Nenhuma avaliação"
          message={status === "PENDENTE" ? "Nada aguardando aprovação." : "Nenhuma avaliação nesta situação."}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((avaliacao) => (
            <li key={avaliacao.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={LOJA_PRODUTO_URL(avaliacao.produtoSlug)}
                    target="_blank"
                    className="text-sm font-semibold text-brand-navy hover:underline"
                  >
                    {avaliacao.produtoNome}
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    <Estrelas valor={avaliacao.nota} tamanho="sm" />
                    <span className="text-xs text-slate-500">{avaliacao.nota}/5</span>
                  </div>
                </div>
                <Badge tone={TOM[avaliacao.status]}>{ROTULO[avaliacao.status]}</Badge>
              </div>

              {avaliacao.comentario ? (
                <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">
                  {avaliacao.comentario}
                </p>
              ) : (
                <p className="mt-3 text-sm italic text-slate-400">Sem comentário, só a nota.</p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500">
                  {avaliacao.nomeExibicao}
                  {avaliacao.clienteEmail && ` (${avaliacao.clienteEmail})`} · pedido{" "}
                  <Link href={`${ROUTES.PEDIDOS}/${avaliacao.pedidoId}`} className="underline underline-offset-2">
                    {avaliacao.pedidoNumero}
                  </Link>{" "}
                  · {formatarData(avaliacao.atualizadaEm)}
                </p>
                <div className="flex gap-2">
                  {avaliacao.status !== "RECUSADA" && (
                    <FormButton
                      type="button"
                      variant="secondary"
                      disabled={salvandoId === avaliacao.id}
                      onClick={() => decidir(avaliacao, "RECUSADA")}
                    >
                      Recusar
                    </FormButton>
                  )}
                  {avaliacao.status !== "APROVADA" && (
                    <FormButton
                      type="button"
                      disabled={salvandoId === avaliacao.id}
                      onClick={() => decidir(avaliacao, "APROVADA")}
                    >
                      Aprovar
                    </FormButton>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
