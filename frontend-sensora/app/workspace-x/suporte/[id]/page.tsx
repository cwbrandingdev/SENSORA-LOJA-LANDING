"use client";

// Detalhe de uma solicitação de suporte (GET /admin/suporte/:id) — destino
// do link do e-mail de aviso aos admins. ADMIN-only (o backend responde 403
// aos demais). O painel só acompanha o status: a resposta ao cliente é por
// e-mail, pelo link "Responder por e-mail", fora do sistema.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isAxiosError } from "axios";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import FormButton from "@/components/ui/FormButton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import StatusSuporteBadge, { formatarDataSuporte } from "@/components/admin/StatusSuporteBadge";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import {
  PerfilUsuario,
  ROTULOS_STATUS_SUPORTE,
  type SolicitacaoSuporteDetalhe,
} from "@/lib/types/loja";
import { atualizarStatusSuporte, buscarSolicitacaoSuporte } from "@/services/suporte";

type NovoStatus = "EM_ATENDIMENTO" | "RESOLVIDA";

const cardClass = "rounded-lg border border-slate-200 bg-white p-4";

export default function SuporteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const solicitacaoId = Number(id);
  const { perfil } = useAuth();
  const toast = useToast();

  const [solicitacao, setSolicitacao] = useState<SolicitacaoSuporteDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  // Incrementado para carregar de novo depois de um erro.
  const [tentativa, setTentativa] = useState(0);

  const [novoStatus, setNovoStatus] = useState<NovoStatus | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (perfil !== PerfilUsuario.ADMIN) return;
    let ativo = true;
    buscarSolicitacaoSuporte(solicitacaoId)
      .then((dados) => {
        if (!ativo) return;
        setSolicitacao(dados);
        setErro(null);
      })
      .catch((err) => {
        if (!ativo) return;
        if (isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 400)) {
          setNaoEncontrada(true);
        } else {
          setErro(getErrorMessage(err, "Não foi possível carregar a solicitação."));
        }
      });
    return () => {
      ativo = false;
    };
  }, [perfil, solicitacaoId, tentativa]);

  function recarregar() {
    setErro(null);
    setTentativa((n) => n + 1);
  }

  async function handleConfirmarStatus() {
    if (!solicitacao || !novoStatus || salvando) return;
    setSalvando(true);
    try {
      const atualizada = await atualizarStatusSuporte(solicitacao.id, novoStatus);
      setSolicitacao(atualizada);
      setNovoStatus(null);
      toast.success(`Solicitação marcada como ${ROTULOS_STATUS_SUPORTE[novoStatus].toLowerCase()}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível atualizar o status."));
    } finally {
      setSalvando(false);
    }
  }

  if (perfil !== PerfilUsuario.ADMIN) {
    return (
      <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        Acesso restrito a administradores.
      </p>
    );
  }

  const voltar = (
    <Link href={ROUTES.SUPORTE} className="text-sm text-slate-500 underline underline-offset-2">
      Voltar para Suporte
    </Link>
  );

  if (naoEncontrada) {
    return (
      <div className="flex flex-col gap-4">
        {voltar}
        <EmptyState title="Solicitação não encontrada" message="Essa solicitação não existe." />
      </div>
    );
  }
  if (erro) {
    return (
      <div className="flex flex-col gap-4">
        {voltar}
        <InlineErrorState message={erro} onRetry={recarregar} />
      </div>
    );
  }
  if (!solicitacao) {
    return <TableSkeleton rows={4} columns={2} />;
  }

  const responder = `mailto:${solicitacao.email}?subject=${encodeURIComponent(
    `Re: ${solicitacao.assunto}`,
  )}`;

  return (
    <div className="flex flex-col gap-4">
      {voltar}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-brand-navy">
            Solicitação #{solicitacao.id}
          </h2>
          <StatusSuporteBadge status={solicitacao.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={responder}
            className="inline-flex items-center justify-center rounded-md border border-brand-navy bg-white px-3 py-3 text-sm font-medium text-brand-navy transition-colors hover:bg-slate-50 sm:py-2"
          >
            Responder por e-mail
          </a>
          {solicitacao.status !== "EM_ATENDIMENTO" && (
            <FormButton type="button" variant="secondary" onClick={() => setNovoStatus("EM_ATENDIMENTO")}>
              Marcar em atendimento
            </FormButton>
          )}
          {solicitacao.status !== "RESOLVIDA" && (
            <FormButton type="button" onClick={() => setNovoStatus("RESOLVIDA")}>
              Marcar como resolvida
            </FormButton>
          )}
        </div>
      </div>

      <section className={cardClass} aria-label="Cliente">
        <h3 className="text-sm font-semibold text-brand-navy">Cliente</h3>
        <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          <dt className="text-slate-500">Nome</dt>
          <dd>{solicitacao.nome}</dd>
          <dt className="text-slate-500">E-mail</dt>
          <dd>{solicitacao.email}</dd>
          <dt className="text-slate-500">Aberta em</dt>
          <dd>{formatarDataSuporte(solicitacao.criadaEm)}</dd>
          <dt className="text-slate-500">Atualizada em</dt>
          <dd>{formatarDataSuporte(solicitacao.atualizadaEm)}</dd>
        </dl>
      </section>

      <section className={cardClass} aria-label="Solicitação">
        <h3 className="text-sm font-semibold text-brand-navy">{solicitacao.assunto}</h3>
        <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">
          {solicitacao.mensagem}
        </p>
      </section>

      <ConfirmDialog
        open={novoStatus !== null}
        title={
          novoStatus === "RESOLVIDA" ? "Marcar como resolvida?" : "Marcar em atendimento?"
        }
        description={
          novoStatus === "RESOLVIDA"
            ? "Use depois de responder o cliente por e-mail. O cliente não recebe nenhum aviso automático."
            : "Indica que alguém está cuidando desta solicitação. O cliente não recebe nenhum aviso automático."
        }
        confirmLabel="Confirmar"
        confirmingLabel="Salvando..."
        confirmVariant="primary"
        confirming={salvando}
        onConfirm={handleConfirmarStatus}
        onCancel={() => {
          if (!salvando) setNovoStatus(null);
        }}
      />
    </div>
  );
}
