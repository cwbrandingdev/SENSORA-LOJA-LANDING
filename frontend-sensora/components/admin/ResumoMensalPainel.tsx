"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Truck,
  Users,
  Wallet,
  ShoppingBag,
  RotateCcw,
} from "lucide-react";
import MetricCard from "@/components/admin/MetricCard";
import InlineErrorState from "@/components/ui/InlineErrorState";
import { getErrorMessage } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import { buscarResumoMensal } from "@/services/dashboard";
import { StatusPedido, type DashboardResumoMensal } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const STATUS_LABEL: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "Pendentes",
  [StatusPedido.PAGO]: "Pagos",
  [StatusPedido.CANCELADO]: "Cancelados",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "Reembolso solicitado",
  [StatusPedido.REEMBOLSADO]: "Reembolsados",
};

type MesOpcao = { ano: number; mes: number; value: string; label: string };

function gerarOpcoesMeses(quantidade = 24): MesOpcao[] {
  const hoje = new Date();
  const opcoes: MesOpcao[] = [];
  for (let i = 0; i < quantidade; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;
    const label = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(d);
    opcoes.push({
      ano,
      mes,
      value: `${ano}-${mes}`,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    });
  }
  return opcoes;
}

function valorMes(opcoes: MesOpcao[], ano: number, mes: number): string {
  return opcoes.find((o) => o.ano === ano && o.mes === mes)?.value ?? `${ano}-${mes}`;
}

function parseMes(value: string): { ano: number; mes: number } | null {
  const match = /^(\d{4})-(\d{1,2})$/.exec(value);
  if (!match) return null;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  if (mes < 1 || mes > 12) return null;
  return { ano, mes };
}

function mesAnterior(ano: number, mes: number): { ano: number; mes: number } {
  if (mes === 1) return { ano: ano - 1, mes: 12 };
  return { ano, mes: mes - 1 };
}

function ultimoDiaMes(ano: number, mes: number): string {
  const ultimo = new Date(ano, mes, 0);
  const y = ultimo.getFullYear();
  const m = String(ultimo.getMonth() + 1).padStart(2, "0");
  const d = String(ultimo.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function VariacaoIndicador({ valor }: { valor: number | null }) {
  if (valor === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Minus className="h-3 w-3" aria-hidden />
        Sem base
      </span>
    );
  }
  if (valor === 0) {
    return <span className="text-xs text-slate-500">Igual ao mês anterior</span>;
  }
  const positivo = valor > 0;
  const Icon = positivo ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        positivo ? "text-emerald-700" : "text-red-600"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {positivo ? "+" : ""}
      {valor.toFixed(1)}% vs comparação
    </span>
  );
}

type ResumoMensalPainelProps = {
  anoInicial?: number;
  mesInicial?: number;
};

export default function ResumoMensalPainel({
  anoInicial,
  mesInicial,
}: ResumoMensalPainelProps) {
  const opcoesMeses = useMemo(() => gerarOpcoesMeses(36), []);
  const padrao = opcoesMeses[0];
  const periodoInicial =
    anoInicial && mesInicial
      ? valorMes(opcoesMeses, anoInicial, mesInicial)
      : padrao.value;
  const periodoInicialParsed = parseMes(periodoInicial) ?? {
    ano: padrao.ano,
    mes: padrao.mes,
  };
  const comparacaoInicial = mesAnterior(
    periodoInicialParsed.ano,
    periodoInicialParsed.mes,
  );

  const [periodoValue, setPeriodoValue] = useState(periodoInicial);
  const [comparacaoValue, setComparacaoValue] = useState(
    valorMes(opcoesMeses, comparacaoInicial.ano, comparacaoInicial.mes),
  );
  const [dados, setDados] = useState<DashboardResumoMensal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const periodo = parseMes(periodoValue);
    if (!periodo) return;

    setCarregando(true);
    setErro(null);

    const comparacao = parseMes(comparacaoValue);
    if (!comparacao) return;

    try {
      const resposta = await buscarResumoMensal({
        ano: periodo.ano,
        mes: periodo.mes,
        compararAno: comparacao.ano,
        compararMes: comparacao.mes,
      });
      setDados(resposta);
    } catch (motivo) {
      setDados(null);
      setErro(getErrorMessage(motivo, "Não foi possível carregar o resumo."));
    } finally {
      setCarregando(false);
    }
  }, [periodoValue, comparacaoValue, opcoesMeses]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const loading = carregando && dados === null && !erro;
  const periodo = dados?.periodo;
  const comparacao = dados?.comparacao;
  const variacao = dados?.variacao;

  const maxFaturamentoDia = useMemo(() => {
    if (!periodo?.porDia.length) return 1;
    return Math.max(...periodo.porDia.map((d) => d.faturamento), 1);
  }, [periodo?.porDia]);

  const periodoParsed = parseMes(periodoValue);
  const linkPedidosMes =
    periodoParsed &&
    `${ROUTES.PEDIDOS}?dataDe=${periodoParsed.ano}-${String(periodoParsed.mes).padStart(2, "0")}-01&dataAte=${ultimoDiaMes(periodoParsed.ano, periodoParsed.mes)}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[12rem] flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">Mês analisado</span>
          <select
            value={periodoValue}
            onChange={(e) => {
              const novo = e.target.value;
              setPeriodoValue(novo);
              const parsed = parseMes(novo);
              if (parsed) {
                const ant = mesAnterior(parsed.ano, parsed.mes);
                setComparacaoValue(valorMes(opcoesMeses, ant.ano, ant.mes));
              }
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          >
            {opcoesMeses.map((opcao) => (
              <option key={opcao.value} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[12rem] flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">Comparar com</span>
          <select
            value={comparacaoValue}
            onChange={(e) => setComparacaoValue(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          >
            {opcoesMeses.map((opcao) => (
              <option key={`cmp-${opcao.value}`} value={opcao.value}>
                {opcao.label}
              </option>
            ))}
          </select>
        </label>

        {linkPedidosMes && (
          <Link
            href={linkPedidosMes}
            className="text-sm font-medium text-brand-navy underline-offset-2 hover:underline"
          >
            Ver pedidos do mês
          </Link>
        )}
      </div>

      {erro && !loading && (
        <InlineErrorState mensagem={erro} onRetry={() => void carregar()} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <MetricCard
            titulo="Faturamento (pagos)"
            icon={Wallet}
            destaque
            loading={loading}
            erro={erro ?? undefined}
            valor={periodo ? formatPrice.format(periodo.faturamento) : undefined}
            descricao={
              comparacao
                ? `${comparacao.label}: ${formatPrice.format(comparacao.faturamento)}`
                : undefined
            }
          />
          {variacao && !loading && !erro && (
            <div className="mt-2 pl-1">
              <VariacaoIndicador valor={variacao.faturamento} />
            </div>
          )}
        </div>
        <MetricCard
          titulo="Pedidos pagos"
          icon={ShoppingBag}
          iconTone="navy"
          loading={loading}
          erro={erro ?? undefined}
          valor={periodo ? String(periodo.pedidos.pagos) : undefined}
          descricao={
            periodo
              ? `${periodo.pedidos.total} pedidos no mês (todos os status)`
              : undefined
          }
        />
        <MetricCard
          titulo="Ticket médio"
          icon={Wallet}
          iconTone="orange-outline"
          loading={loading}
          erro={erro ?? undefined}
          valor={periodo ? formatPrice.format(periodo.ticketMedio) : undefined}
          descricao={comparacao ? `Antes: ${formatPrice.format(comparacao.ticketMedio)}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          titulo="Frete (pagos)"
          icon={Truck}
          iconTone="navy-outline"
          loading={loading}
          erro={erro ?? undefined}
          valor={periodo ? formatPrice.format(periodo.frete) : undefined}
          descricao="Soma do frete nos pedidos pagos"
        />
        <MetricCard
          titulo="Compradores únicos"
          icon={Users}
          iconTone="orange-outline"
          loading={loading}
          erro={erro ?? undefined}
          valor={periodo ? String(periodo.clientesUnicos) : undefined}
          descricao="Clientes distintos com compra paga"
        />
        <MetricCard
          titulo="Reembolsado"
          icon={RotateCcw}
          iconTone="navy"
          loading={loading}
          erro={erro ?? undefined}
          valor={periodo ? formatPrice.format(periodo.valorReembolsado) : undefined}
          descricao="Total de pedidos reembolsados no mês"
        />
      </div>

      {periodo && !loading && !erro && (
        <>
          <section className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
              Faturamento por dia
            </h3>
            {periodo.porDia.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                Nenhum pedido pago neste mês.
              </p>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                <ul className="flex flex-col gap-2">
                  {periodo.porDia.map((dia) => {
                    const largura = Math.max(
                      4,
                      Math.round((dia.faturamento / maxFaturamentoDia) * 100),
                    );
                    const [, m, d] = dia.dia.split("-");
                    return (
                      <li key={dia.dia} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 text-sm">
                        <span className="tabular-nums text-slate-500">{d}/{m}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-orange transition-all"
                            style={{ width: `${largura}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-right text-slate-700">
                          {formatPrice.format(dia.faturamento)}
                          <span className="ml-1 text-xs text-slate-400">
                            ({dia.pedidosPagos})
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
                Pedidos por status
              </h3>
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                <ul className="divide-y divide-slate-100">
                  {Object.values(StatusPedido).map((status) => {
                    const qtd = periodo.pedidos.porStatus[status];
                    const ant = comparacao?.pedidos.porStatus[status] ?? 0;
                    const diff = qtd - ant;
                    return (
                      <li
                        key={status}
                        className="flex items-center justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0"
                      >
                        <span className="text-slate-700">{STATUS_LABEL[status]}</span>
                        <span className="tabular-nums font-medium text-brand-navy">
                          {qtd}
                          {comparacao && diff !== 0 && (
                            <span
                              className={`ml-2 text-xs font-normal ${
                                diff > 0 ? "text-emerald-700" : "text-red-600"
                              }`}
                            >
                              ({diff > 0 ? "+" : ""}
                              {diff})
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
                Produtos mais vendidos
              </h3>
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                {periodo.topProdutos.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma venda paga no período.</p>
                ) : (
                  <ol className="flex flex-col gap-4">
                    {periodo.topProdutos.map((item, index) => (
                      <li key={item.produtoId} className="flex gap-3 text-sm">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy/8 text-xs font-semibold text-brand-navy">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800">{item.nome}</p>
                          <p className="text-slate-500">
                            {item.quantidade} un. · {formatPrice.format(item.faturamento)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
