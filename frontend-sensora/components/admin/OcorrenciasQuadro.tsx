"use client";

// Quadro das ocorrências do Admin (escolhido na comparação de designs,
// "Quadro por resultado"): uma coluna para cada resultado, como uma
// triagem — falhas e alertas sempre à vista, à esquerda. Carregar, filtrar
// e paginar continuam na página.
import { Fragment } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import {
  ROTULOS_TIPO_OCORRENCIA,
  TOM_RESULTADO_OCORRENCIA,
  type DetalhesOcorrencia,
  type Ocorrencia,
} from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const COLUNAS = [
  { resultado: "FALHA", titulo: "Falhas" },
  { resultado: "ALERTA", titulo: "Alertas" },
  { resultado: "INFO", titulo: "Info" },
  { resultado: "SUCESSO", titulo: "Sucesso" },
];

const TOPO_TOM = {
  neutral: "border-t-slate-300",
  success: "border-t-emerald-500",
  warning: "border-t-amber-500",
  danger: "border-t-red-500",
  info: "border-t-sky-500",
};

const ROTULOS_DETALHES: Record<keyof DetalhesOcorrencia, string> = {
  produtoId: "Produto (id)",
  produtoNome: "Produto",
  quantidadePedida: "Quantidade pedida",
  quantidadeDisponivel: "Quantidade disponível",
  unidadesDevolvidas: "Unidades devolvidas",
  evento: "Evento",
  statusAnterior: "Status anterior",
  statusAtual: "Status atual",
  asaasCode: "Código do Asaas",
  asaasDescription: "Motivo do Asaas",
};

function formatarData(data: string) {
  return new Date(data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// Etapa, gateway, referência externa e detalhes — só aparecem ao expandir.
function Detalhes({ ocorrencia }: { ocorrencia: Ocorrencia }) {
  const linhas: [string, string][] = [["Etapa", ocorrencia.etapa]];
  if (ocorrencia.gateway) linhas.push(["Gateway", ocorrencia.gateway]);
  if (ocorrencia.referenciaExterna) linhas.push(["Referência externa", ocorrencia.referenciaExterna]);
  for (const [chave, valor] of Object.entries(ocorrencia.detalhes ?? {})) {
    linhas.push([ROTULOS_DETALHES[chave as keyof DetalhesOcorrencia] ?? chave, String(valor)]);
  }
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-slate-500 hover:text-brand-navy">Detalhes</summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm">
        {linhas.map(([rotulo, valor]) => (
          <Fragment key={rotulo}>
            <dt className="text-slate-500">{rotulo}</dt>
            <dd className="break-all text-slate-700">{valor}</dd>
          </Fragment>
        ))}
      </dl>
    </details>
  );
}

function Cartao({ ocorrencia }: { ocorrencia: Ocorrencia }) {
  return (
    <article className="rounded-md bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <p className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="font-medium uppercase tracking-wide">
          {ROTULOS_TIPO_OCORRENCIA[ocorrencia.tipo] ?? ocorrencia.tipo}
        </span>
        <span className="tabular-nums">{formatarData(ocorrencia.criadoEm)}</span>
      </p>
      <p className="mt-1 text-sm text-slate-800">{ocorrencia.mensagem}</p>
      <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-slate-500">
        {ocorrencia.cliente && <span>{ocorrencia.cliente.nome}</span>}
        {ocorrencia.pedidoId && (
          <Link
            href={`${ROUTES.PEDIDOS}/${ocorrencia.pedidoId}`}
            className="text-brand-navy underline-offset-2 hover:underline"
          >
            Pedido {ocorrencia.pedidoNumero ?? `#${ocorrencia.pedidoId}`}
          </Link>
        )}
        {ocorrencia.devolucaoId && (
          <Link
            href={`${ROUTES.DEVOLUCOES}/${ocorrencia.devolucaoId}`}
            className="text-brand-navy underline-offset-2 hover:underline"
          >
            Devolução #{ocorrencia.devolucaoId}
          </Link>
        )}
        {ocorrencia.valor !== null && <span>{formatPrice.format(ocorrencia.valor)}</span>}
      </p>
      <Detalhes ocorrencia={ocorrencia} />
    </article>
  );
}

export default function OcorrenciasQuadro({ ocorrencias }: { ocorrencias: Ocorrencia[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUNAS.map(({ resultado, titulo }) => {
        const itens = ocorrencias.filter((o) => o.resultado === resultado);
        const tom = TOM_RESULTADO_OCORRENCIA[resultado] ?? "neutral";
        return (
          <section
            key={resultado}
            className={`flex flex-col rounded-lg border border-t-4 border-slate-200 bg-slate-50 ${TOPO_TOM[tom]}`}
          >
            <h3 className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-brand-navy">
              {titulo}
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                {itens.length}
              </span>
            </h3>
            <div className="flex flex-col gap-2 px-3 pb-3">
              {itens.length === 0 ? (
                <p className="px-1 py-4 text-center text-sm text-slate-400">Nada aqui.</p>
              ) : (
                itens.map((ocorrencia) => <Cartao key={ocorrencia.id} ocorrencia={ocorrencia} />)
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
