"use client";

// Etapa 8 — logística reversa no detalhe da devolução (Workspace-X, só
// ADMIN). Depois de APROVADA: cotação cliente -> loja, escolha do serviço e
// "Gerar código de devolução" (pago com o saldo da carteira do Melhor Envio,
// por isso a confirmação mostra o custo, que vira o teto da compra). Depois
// de gerada: código de devolução (o que o cliente apresenta nos Correios),
// rastreio, documento do envio (secundário) e confirmação de recebimento.
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormButton from "@/components/ui/FormButton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import type { DevolucaoAnalise, OpcaoFreteDevolucao } from "@/lib/types/loja";
import {
  atualizarRastreioDevolucao,
  confirmarRecebimentoDevolucao,
  cotarFreteDevolucao,
  gerarLogisticaDevolucao,
  urlDocumentoEnvioDevolucaoAdmin,
} from "@/services/devolucoes";

const formatPrice = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatarDataHora(data: string): string {
  return new Date(data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const cardClass = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6";
const tituloCardClass = "text-sm font-semibold uppercase tracking-wide text-slate-500";

type LogisticaDevolucaoProps = {
  devolucao: DevolucaoAnalise;
  onAtualizada: (devolucao: DevolucaoAnalise) => void;
  // Recarrega a devolução (uma geração que falhou no meio pode ter avançado).
  onRecarregar: () => void;
};

export default function LogisticaDevolucao({
  devolucao,
  onAtualizada,
  onRecarregar,
}: LogisticaDevolucaoProps) {
  const toast = useToast();
  const envio = devolucao.envio ?? null;
  const aprovada = devolucao.status === "APROVADA";
  // Geração começou mas parou no meio: retoma com o mesmo serviço.
  const emAndamento = aprovada && envio !== null && !envio.geradaEm;

  const [opcoes, setOpcoes] = useState<OpcaoFreteDevolucao[] | null>(null);
  const [erroCotacao, setErroCotacao] = useState<string | null>(null);
  const [tentativaCotacao, setTentativaCotacao] = useState(0);
  const [servicoId, setServicoId] = useState<number | null>(null);

  const [confirmarGeracao, setConfirmarGeracao] = useState(false);
  const [confirmarRecebimento, setConfirmarRecebimento] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // Cotação só enquanto nenhuma geração começou.
  const precisaCotar = aprovada && envio === null;

  useEffect(() => {
    if (!precisaCotar) return;
    let ativo = true;
    cotarFreteDevolucao(devolucao.id)
      .then((dados) => {
        if (!ativo) return;
        setOpcoes(dados);
        setErroCotacao(null);
      })
      .catch((err) => {
        if (!ativo) return;
        setErroCotacao(getErrorMessage(err, "Não foi possível cotar o frete da devolução."));
      });
    return () => {
      ativo = false;
    };
  }, [precisaCotar, devolucao.id, tentativaCotacao]);

  if (!aprovada && !envio) {
    return null;
  }

  const opcaoEscolhida = opcoes?.find((opcao) => opcao.id === servicoId) ?? null;
  // Custo mostrado e confirmado: o da opção escolhida ou, ao retomar, o já
  // registrado (o do envio criado no Melhor Envio). É o teto da compra.
  const custoConfirmacao = emAndamento ? envio.custo : opcaoEscolhida?.preco;

  async function handleGerar() {
    const servico = emAndamento ? envio.servicoId : servicoId;
    if (servico === null || custoConfirmacao === undefined || ocupado) return;
    setOcupado(true);
    try {
      onAtualizada(await gerarLogisticaDevolucao(devolucao.id, servico, custoConfirmacao));
      setConfirmarGeracao(false);
      toast.success("Código de devolução gerado. O cliente foi avisado por e-mail.");
    } catch (err) {
      setConfirmarGeracao(false);
      toast.error(
        getErrorMessage(err, "Não foi possível gerar o código de devolução. Tente novamente."),
      );
      // A geração pode ter avançado (ou o custo mudado): mostra o estado atual.
      onRecarregar();
    } finally {
      setOcupado(false);
    }
  }

  async function handleAbrirDocumento() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const url = await urlDocumentoEnvioDevolucaoAdmin(devolucao.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível abrir o documento do envio."));
    } finally {
      setOcupado(false);
    }
  }

  async function handleAtualizarRastreio() {
    if (ocupado) return;
    setOcupado(true);
    try {
      onAtualizada(await atualizarRastreioDevolucao(devolucao.id));
      toast.success("Rastreio atualizado.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível atualizar o rastreio."));
    } finally {
      setOcupado(false);
    }
  }

  async function handleConfirmarRecebimento() {
    if (ocupado) return;
    setOcupado(true);
    try {
      onAtualizada(await confirmarRecebimentoDevolucao(devolucao.id));
      setConfirmarRecebimento(false);
      toast.success("Recebimento confirmado.");
    } catch (err) {
      setConfirmarRecebimento(false);
      toast.error(getErrorMessage(err, "Não foi possível confirmar o recebimento."));
      if (isAxiosError(err) && err.response?.status === 409) onRecarregar();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className={cardClass} aria-label="Logística de devolução">
      <h3 className={tituloCardClass}>Logística de devolução</h3>

      {envio?.geradaEm ? (
        <>
          <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
            <dt className="text-slate-500">Transportadora</dt>
            <dd>{envio.transportadora}</dd>
            <dt className="text-slate-500">Serviço</dt>
            <dd>{envio.servico}</dd>
            <dt className="text-slate-500">Custo</dt>
            <dd>{formatPrice.format(envio.custo)}</dd>
            <dt className="text-slate-500">Código de devolução</dt>
            <dd className="font-mono">
              {envio.codigoDevolucao ?? (
                <span className="font-sans text-slate-500">
                  ainda não liberado — use Atualizar rastreio
                </span>
              )}
            </dd>
            <dt className="text-slate-500">Código de rastreio</dt>
            <dd className="font-mono">{envio.codigoRastreio ?? "—"}</dd>
            <dt className="text-slate-500">Postada em</dt>
            <dd>{envio.postadaEm ? formatarDataHora(envio.postadaEm) : "—"}</dd>
            <dt className="text-slate-500">Última situação</dt>
            <dd>
              {envio.situacaoRastreio ?? "—"}
              {envio.rastreioAtualizadoEm && (
                <span className="block text-xs text-slate-500">
                  consultado em {formatarDataHora(envio.rastreioAtualizadoEm)}
                </span>
              )}
            </dd>
            <dt className="text-slate-500">Recebida em</dt>
            <dd>{devolucao.recebidaEm ? formatarDataHora(devolucao.recebidaEm) : "—"}</dd>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {(devolucao.status === "AGUARDANDO_ENVIO" || devolucao.status === "ENVIADA") && (
              <FormButton variant="secondary" onClick={handleAtualizarRastreio} disabled={ocupado}>
                Atualizar rastreio
              </FormButton>
            )}
            {devolucao.status === "ENVIADA" && (
              <FormButton onClick={() => setConfirmarRecebimento(true)} disabled={ocupado}>
                Confirmar recebimento
              </FormButton>
            )}
            {/* Secundário: o cliente devolve com o código, não com etiqueta. */}
            <FormButton variant="ghost" onClick={handleAbrirDocumento} disabled={ocupado}>
              Documento do envio
            </FormButton>
          </div>
        </>
      ) : emAndamento ? (
        <div className="mt-3 flex flex-col gap-3 text-sm">
          <p className="text-slate-700">
            A geração do código de devolução com {envio.transportadora} {envio.servico} (
            {formatPrice.format(envio.custo)}) começou mas não terminou. Tente de novo para
            continuar de onde parou — nenhuma etapa já concluída é repetida.
          </p>
          <div>
            <FormButton onClick={() => setConfirmarGeracao(true)} disabled={ocupado}>
              Gerar código de devolução
            </FormButton>
          </div>
        </div>
      ) : erroCotacao ? (
        <div className="mt-3">
          <InlineErrorState
            message={erroCotacao}
            onRetry={() => {
              setErroCotacao(null);
              setTentativaCotacao((n) => n + 1);
            }}
          />
        </div>
      ) : opcoes === null ? (
        <p className="mt-3 text-sm text-slate-500">Cotando o frete da devolução...</p>
      ) : opcoes.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Nenhum serviço de logística reversa disponível para o endereço deste pedido.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3 text-sm">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-slate-600">
              Escolha o serviço (do endereço do cliente para a loja):
            </legend>
            {opcoes.map((opcao) => (
              <label
                key={opcao.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <input
                  type="radio"
                  name="servico-devolucao"
                  value={opcao.id}
                  checked={servicoId === opcao.id}
                  onChange={() => setServicoId(opcao.id)}
                />
                <span className="flex-1">
                  {opcao.transportadora} {opcao.servico}
                  <span className="block text-xs text-slate-500">
                    {opcao.prazoDias} {opcao.prazoDias === 1 ? "dia útil" : "dias úteis"}
                  </span>
                </span>
                <span className="font-medium">{formatPrice.format(opcao.preco)}</span>
              </label>
            ))}
          </fieldset>
          <div>
            <FormButton
              onClick={() => setConfirmarGeracao(true)}
              disabled={servicoId === null || ocupado}
            >
              Gerar código de devolução
            </FormButton>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmarGeracao}
        title="Gerar código de devolução?"
        description={
          <p>
            Será debitado até{" "}
            <strong>
              {custoConfirmacao !== undefined ? formatPrice.format(custoConfirmacao) : "o valor do frete"}
            </strong>{" "}
            da carteira do Melhor Envio da loja. Se o Melhor Envio informar um valor maior, nada é
            cobrado e você confirma o novo valor. O cliente será avisado por e-mail de que o código
            de devolução está disponível na conta dele.
          </p>
        }
        confirmLabel="Gerar código de devolução"
        confirmingLabel="Gerando..."
        confirming={ocupado}
        onConfirm={handleGerar}
        onCancel={() => !ocupado && setConfirmarGeracao(false)}
      />

      <ConfirmDialog
        open={confirmarRecebimento}
        title="Confirmar recebimento?"
        description={<p>Confirme só depois de o produto ter chegado à loja.</p>}
        confirmLabel="Confirmar recebimento"
        confirmingLabel="Salvando..."
        confirming={ocupado}
        onConfirm={handleConfirmarRecebimento}
        onCancel={() => !ocupado && setConfirmarRecebimento(false)}
      />
    </section>
  );
}
