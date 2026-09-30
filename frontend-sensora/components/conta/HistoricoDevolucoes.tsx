"use client";

// Etapa 6 — histórico das devoluções de um pedido (mais recentes primeiro,
// na ordem que o backend devolve). Só exibe o que recebe: quem carrega os
// dados é a página do pedido. Enquanto a devolução está SOLICITADA, as fotos
// podem ser adicionadas/removidas (EvidenciasDevolucao); depois disso, só
// aparecem para consulta. Etapa 8: com a logística reversa gerada,
// instruções e o código de devolução enquanto aguarda o envio; depois, o
// código de rastreio (quando houver).
import { useState } from "react";
import EvidenciasDevolucao from "@/components/conta/EvidenciasDevolucao";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  ROTULOS_STATUS_DEVOLUCAO,
  type Devolucao,
  type ItemPedidoDetalhado,
} from "@/lib/types/loja";
import { urlDocumentoEnvioMinhaDevolucao } from "@/services/pedidos";

function formatarData(data: string): string {
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Logística reversa: o cliente devolve apresentando o código de devolução
// nos Correios — não precisa de etiqueta. O documento do envio é só um
// recurso secundário (URL pedida ao backend no clique, gerada na hora, nunca
// guardada).
function EnvioDaDevolucao({ pedidoId, devolucao }: { pedidoId: number; devolucao: Devolucao }) {
  const toast = useToast();
  const [abrindo, setAbrindo] = useState(false);
  const { envio } = devolucao;
  if (!envio) return null;

  async function handleDocumento() {
    if (abrindo) return;
    setAbrindo(true);
    try {
      const url = await urlDocumentoEnvioMinhaDevolucao(pedidoId, devolucao.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível abrir o documento. Tente novamente."));
    } finally {
      setAbrindo(false);
    }
  }

  const rastreio = envio.codigoRastreio && (
    <p className="text-sm text-slate-600">
      Código de rastreio:{" "}
      <span className="font-mono text-brand-navy">{envio.codigoRastreio}</span>
    </p>
  );

  if (devolucao.status !== "AGUARDANDO_ENVIO") {
    return rastreio ? <div className="mt-3">{rastreio}</div> : null;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-md bg-slate-50 p-4">
      <p className="text-sm font-medium text-brand-navy">Como devolver</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Embale o(s) produto(s) acima.</li>
        <li>
          Leve o pacote a uma agência dos Correios e apresente o código de devolução. Não é preciso
          imprimir etiqueta.
        </li>
        <li>O frete já foi pago pela loja. O código tem prazo de validade: poste o quanto antes.</li>
      </ol>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500">Código de devolução</dt>
        <dd>
          {envio.codigoDevolucao ? (
            <span className="font-mono text-base font-semibold text-brand-navy">
              {envio.codigoDevolucao}
            </span>
          ) : (
            <span className="text-slate-600">
              Sendo emitido pelos Correios. Volte a esta página em alguns minutos.
            </span>
          )}
        </dd>
        <dt className="text-slate-500">Envio</dt>
        <dd className="text-slate-700">
          {envio.transportadora} {envio.servico}
        </dd>
      </dl>
      {rastreio}
      <div>
        <button
          type="button"
          onClick={handleDocumento}
          disabled={abrindo}
          className="text-sm text-slate-600 underline underline-offset-2 hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
        >
          {abrindo ? "Abrindo..." : "Ver documento do envio (opcional)"}
        </button>
      </div>
    </div>
  );
}

type HistoricoDevolucoesProps = {
  pedidoId: number;
  devolucoes: Devolucao[];
  // Itens do pedido, só para mostrar o nome do produto de cada item devolvido.
  itensPedido: ItemPedidoDetalhado[];
};

export default function HistoricoDevolucoes({
  pedidoId,
  devolucoes,
  itensPedido,
}: HistoricoDevolucoesProps) {
  const nomeDoItem = (itemPedidoId: number) =>
    itensPedido.find((item) => item.id === itemPedidoId)?.produtoNome ?? "Produto";

  return (
    <div className="mt-8">
      <h2 className="font-serif text-xl font-normal text-brand-navy">Devoluções</h2>
      <ul className="mt-4 flex flex-col gap-4">
        {devolucoes.map((devolucao) => (
          <li
            key={devolucao.id}
            aria-label={`Devolução solicitada em ${formatarData(devolucao.solicitadaEm)}`}
            className="rounded-lg border border-slate-200 p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                Solicitada em {formatarData(devolucao.solicitadaEm)}
                {devolucao.analisadaEm && ` · Analisada em ${formatarData(devolucao.analisadaEm)}`}
              </p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-brand-navy">
                {ROTULOS_STATUS_DEVOLUCAO[devolucao.status] ?? devolucao.status}
              </span>
            </div>

            <p className="mt-3 text-sm text-brand-navy">
              <span className="font-medium">Motivo:</span> {devolucao.motivo}
            </p>
            {devolucao.descricao && (
              <p className="mt-1 text-sm text-slate-600">{devolucao.descricao}</p>
            )}

            <ul className="mt-3 text-sm text-slate-600">
              {devolucao.itens.map((item) => (
                <li key={item.id}>
                  {item.quantidade} × {nomeDoItem(item.itemPedidoId)}
                </li>
              ))}
            </ul>

            <EnvioDaDevolucao pedidoId={pedidoId} devolucao={devolucao} />

            {devolucao.status === "SOLICITADA" ? (
              <EvidenciasDevolucao
                pedidoId={pedidoId}
                devolucaoId={devolucao.id}
                evidenciasIniciais={devolucao.evidencias}
              />
            ) : (
              devolucao.evidencias.length > 0 && (
                <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {devolucao.evidencias.map((evidencia) => (
                    <li
                      key={evidencia.id}
                      className="aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={evidencia.url}
                        alt="Foto da devolução"
                        className="h-full w-full object-cover"
                      />
                    </li>
                  ))}
                </ul>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
