"use client";

// Etapa 6 — histórico das devoluções de um pedido (mais recentes primeiro,
// na ordem que o backend devolve). Só exibe o que recebe: quem carrega os
// dados é a página do pedido. Enquanto a devolução está SOLICITADA, as fotos
// podem ser adicionadas/removidas (EvidenciasDevolucao); depois disso, só
// aparecem para consulta.
import EvidenciasDevolucao from "@/components/conta/EvidenciasDevolucao";
import {
  ROTULOS_STATUS_DEVOLUCAO,
  type Devolucao,
  type ItemPedidoDetalhado,
} from "@/lib/types/loja";

function formatarData(data: string): string {
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
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
