"use client";

// Etapa 7 — análise de uma devolução (GET /admin/devolucoes/:id) e decisão
// (aprovar/recusar). ADMIN-only no backend. Aprovar/recusar só decidem:
// nenhum reembolso e nenhum estoque são tocados nesta etapa. Etapa 8: depois
// de aprovada, a seção Logística de devolução (LogisticaDevolucao).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isAxiosError } from "axios";
import LogisticaDevolucao from "@/components/admin/LogisticaDevolucao";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import FormButton from "@/components/ui/FormButton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import {
  PerfilUsuario,
  ROTULOS_STATUS_DEVOLUCAO,
  StatusEnvio,
  StatusPedido,
  TOM_STATUS_DEVOLUCAO,
  type DevolucaoAnalise,
} from "@/lib/types/loja";
import { aprovarDevolucao, buscarDevolucaoAdmin, recusarDevolucao } from "@/services/devolucoes";

const formatPrice = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const ROTULOS_STATUS_PEDIDO: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "Pendente",
  [StatusPedido.PAGO]: "Pago",
  [StatusPedido.CANCELADO]: "Cancelado",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "Reembolso solicitado",
  [StatusPedido.REEMBOLSADO]: "Reembolsado",
};

// Datas com hora (solicitação/análise); a data do pedido é meia-noite UTC,
// por isso usa timeZone UTC (mesma correção do detalhe do pedido).
function formatarDataHora(data: string): string {
  return new Date(data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function formatarDataPedido(data: string): string {
  return new Date(data).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const cardClass = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6";
const tituloCardClass = "text-sm font-semibold uppercase tracking-wide text-slate-500";
const thClass = "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500";
const tdClass = "px-4 py-3 text-slate-700";

type Decisao = "aprovar" | "recusar";

export default function DevolucaoAnalisePage() {
  const { id } = useParams<{ id: string }>();
  const devolucaoId = Number(id);
  const { perfil } = useAuth();
  const toast = useToast();

  const [devolucao, setDevolucao] = useState<DevolucaoAnalise | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  // Incrementado para carregar de novo (erro, ou 409 na decisão).
  const [tentativa, setTentativa] = useState(0);

  const [decisao, setDecisao] = useState<Decisao | null>(null);
  const [observacao, setObservacao] = useState("");
  const [erroObservacao, setErroObservacao] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (perfil !== PerfilUsuario.ADMIN) return;
    let ativo = true;
    buscarDevolucaoAdmin(devolucaoId)
      .then((dados) => {
        if (!ativo) return;
        setDevolucao(dados);
        setErro(null);
      })
      .catch((err) => {
        if (!ativo) return;
        if (isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 400)) {
          setNaoEncontrada(true);
        } else {
          setErro(getErrorMessage(err, "Não foi possível carregar a devolução."));
        }
      });
    return () => {
      ativo = false;
    };
  }, [perfil, devolucaoId, tentativa]);

  function recarregar() {
    setErro(null);
    setTentativa((n) => n + 1);
  }

  function abrirDecisao(nova: Decisao) {
    setObservacao("");
    setErroObservacao(null);
    setDecisao(nova);
  }

  function fecharDecisao() {
    if (enviando) return;
    setDecisao(null);
  }

  async function handleConfirmarDecisao() {
    if (!devolucao || !decisao || enviando) return;

    const texto = observacao.trim();
    if (decisao === "recusar" && !texto) {
      setErroObservacao("Informe o motivo da recusa.");
      return;
    }

    setErroObservacao(null);
    setEnviando(true);
    try {
      const atualizada =
        decisao === "aprovar"
          ? await aprovarDevolucao(devolucao.id, texto || undefined)
          : await recusarDevolucao(devolucao.id, texto);
      setDevolucao(atualizada);
      setDecisao(null);
      toast.success(decisao === "aprovar" ? "Devolução aprovada." : "Devolução recusada.");
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        // Alguém já decidiu, ou o pedido mudou: mostra o motivo e recarrega.
        toast.error(getErrorMessage(err, "Esta devolução não pode mais ser analisada."));
        setDecisao(null);
        recarregar();
      } else {
        setErroObservacao(
          getErrorMessage(err, "Não foi possível registrar a decisão. Tente novamente."),
        );
      }
    } finally {
      setEnviando(false);
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
    <Link href={ROUTES.DEVOLUCOES} className="text-sm text-slate-500 underline underline-offset-2">
      Voltar para Devoluções
    </Link>
  );

  if (naoEncontrada) {
    return (
      <div className="flex flex-col gap-4">
        {voltar}
        <EmptyState title="Devolução não encontrada" message="Essa devolução não existe." />
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
  if (!devolucao) {
    return <TableSkeleton rows={4} columns={4} />;
  }

  const { pedido } = devolucao;
  const aguardandoAnalise =
    devolucao.status === "SOLICITADA" || devolucao.status === "EM_ANALISE";

  return (
    <div className="flex flex-col gap-4">
      {voltar}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-brand-navy">Devolução #{devolucao.id}</h2>
          <Badge tone={TOM_STATUS_DEVOLUCAO[devolucao.status] ?? "neutral"}>
            {ROTULOS_STATUS_DEVOLUCAO[devolucao.status] ?? devolucao.status}
          </Badge>
        </div>
        {aguardandoAnalise && (
          <div className="flex gap-2">
            <FormButton type="button" onClick={() => abrirDecisao("aprovar")}>
              Aprovar
            </FormButton>
            <FormButton type="button" variant="danger" onClick={() => abrirDecisao("recusar")}>
              Recusar
            </FormButton>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={cardClass} aria-label="Pedido">
          <h3 className={tituloCardClass}>Pedido</h3>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <dt className="text-slate-500">Número</dt>
            <dd>
              <Link
                href={`${ROUTES.PEDIDOS}/${pedido.id}`}
                className="font-medium text-brand-navy underline underline-offset-2"
              >
                {pedido.numero}
              </Link>
            </dd>
            <dt className="text-slate-500">Data</dt>
            <dd>{formatarDataPedido(pedido.data)}</dd>
            <dt className="text-slate-500">Status</dt>
            <dd>{ROTULOS_STATUS_PEDIDO[pedido.status] ?? pedido.status}</dd>
            <dt className="text-slate-500">Envio</dt>
            <dd>
              {pedido.statusEnvio === StatusEnvio.ENVIADO
                ? `Enviado${pedido.enviadoEm ? ` em ${formatarDataHora(pedido.enviadoEm)}` : ""}`
                : "Não enviado"}
            </dd>
            <dt className="text-slate-500">Total</dt>
            <dd>{formatPrice.format(pedido.total)}</dd>
            <dt className="text-slate-500">Cliente</dt>
            <dd>
              {devolucao.cliente.nome ?? "—"}
              {devolucao.cliente.email && (
                <span className="block text-xs text-slate-500">{devolucao.cliente.email}</span>
              )}
            </dd>
          </dl>
        </section>

        <section className={cardClass} aria-label="Solicitação">
          <h3 className={tituloCardClass}>Solicitação</h3>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <dt className="text-slate-500">Motivo</dt>
            <dd>{devolucao.motivo}</dd>
            <dt className="text-slate-500">Descrição</dt>
            <dd>{devolucao.descricao ?? "—"}</dd>
            <dt className="text-slate-500">Solicitada em</dt>
            <dd>{formatarDataHora(devolucao.solicitadaEm)}</dd>
            <dt className="text-slate-500">Analisada em</dt>
            <dd>{devolucao.analisadaEm ? formatarDataHora(devolucao.analisadaEm) : "—"}</dd>
            <dt className="text-slate-500">Analisada por</dt>
            <dd>{devolucao.analisadoPorNome ?? "—"}</dd>
            <dt className="text-slate-500">Observação</dt>
            <dd>{devolucao.observacaoAnalise ?? "—"}</dd>
          </dl>
        </section>
      </div>

      <LogisticaDevolucao
        devolucao={devolucao}
        onAtualizada={setDevolucao}
        onRecarregar={recarregar}
      />

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm" aria-label="Itens da devolução">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className={thClass}>Produto</th>
              <th className={thClass}>Solicitada</th>
              <th className={thClass}>Comprada</th>
              <th className={thClass}>Preço unitário</th>
            </tr>
          </thead>
          <tbody>
            {devolucao.itens.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className={tdClass}>{item.produtoNome}</td>
                <td className={tdClass}>{item.quantidade}</td>
                <td className={tdClass}>{item.quantidadeComprada}</td>
                <td className={tdClass}>{formatPrice.format(item.precoUnitario)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={cardClass} aria-label="Fotos">
        <h3 className={tituloCardClass}>Fotos</h3>
        {devolucao.evidencias.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">O cliente não enviou fotos.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {devolucao.evidencias.map((evidencia) => (
              <li
                key={evidencia.id}
                className="aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50"
              >
                {/* URL assinada de validade curta (10 min). */}
                <a href={evidencia.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={evidencia.url}
                    alt="Foto enviada pelo cliente"
                    className="h-full w-full object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={decisao !== null}
        title={decisao === "aprovar" ? "Aprovar devolução?" : "Recusar devolução?"}
        description={
          <div className="flex flex-col gap-3">
            <p>
              {decisao === "aprovar"
                ? "O cliente será avisado por e-mail. Nenhum reembolso é feito agora."
                : "O cliente será avisado por e-mail com o motivo da recusa."}
            </p>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700">
                {decisao === "aprovar" ? "Observação (opcional)" : "Motivo da recusa"}
              </span>
              <textarea
                value={observacao}
                onChange={(event) => setObservacao(event.target.value)}
                maxLength={1000}
                rows={3}
                disabled={enviando}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
              />
            </label>
            {erroObservacao && (
              <p role="alert" className="text-sm text-red-600">
                {erroObservacao}
              </p>
            )}
          </div>
        }
        confirmLabel={decisao === "aprovar" ? "Aprovar" : "Recusar"}
        confirmingLabel="Salvando..."
        confirmVariant={decisao === "aprovar" ? "primary" : "danger"}
        confirming={enviando}
        onConfirm={handleConfirmarDecisao}
        onCancel={fecharDecisao}
      />
    </div>
  );
}
