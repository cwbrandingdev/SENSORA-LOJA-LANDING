"use client";

// Client Component (não Server Component) pelo mesmo motivo de todas as
// outras páginas de /admin/**: o Next só evita renderizar o conteúdo de uma
// página no servidor — e portanto no HTML/RSC inicial, antes de
// ProtectedLayout decidir se autoriza o acesso — quando ela é "use client".
// Achado da auditoria: como Server Component, este dashboard era a única
// página do admin cujo conteúdo (ainda que só texto estático) chegava no
// payload de uma requisição não autenticada.
//
// Etapa 6.6 (Dashboard Admin, Lote 2) — os 4 cards de "Visão geral" passam a
// consumir dados reais de GET /pedidos, GET /produtos e GET /categorias (as
// únicas APIs autorizadas neste lote — nenhum endpoint novo). As três
// chamadas disparam juntas via Promise.allSettled (nenhuma espera a outra
// terminar) e cada card tem seu próprio estado de loading/erro: uma falhar
// nunca apaga os outros que carregaram com sucesso. Faturamento/Pedidos/
// Produtos/Categorias vazios (listas vazias, sem PAGO nenhum) são estados
// legítimos, distintos de erro — nunca tratados como falha.
import { useEffect, useState } from "react";
import MetricCard from "@/components/admin/MetricCard";
import { getErrorMessage } from "@/lib/errors";
import { listarCategorias } from "@/services/categorias";
import { listarPedidos } from "@/services/pedidos";
import { listarProdutos } from "@/services/produtos";
import { StatusPedido, type Categoria, type Pedido, type Produto } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Só os status que já existem em StatusPedido (backend/prisma/schema.prisma)
// — nenhum valor novo, nenhuma métrica inventada.
const STATUS_LABEL: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "pendentes",
  [StatusPedido.PAGO]: "pagos",
  [StatusPedido.CANCELADO]: "cancelados",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "em reembolso",
  [StatusPedido.REEMBOLSADO]: "reembolsados",
};

// Distribuição por status (card "Pedidos") — só os status com pelo menos 1
// pedido aparecem, na mesma ordem de StatusPedido. Lista vazia é um estado
// legítimo ("Nenhum pedido registrado"), não um erro.
function descricaoPorStatus(pedidos: Pedido[]): string {
  if (pedidos.length === 0) return "Nenhum pedido registrado";

  const contagem = new Map<StatusPedido, number>();
  for (const pedido of pedidos) {
    contagem.set(pedido.status, (contagem.get(pedido.status) ?? 0) + 1);
  }

  return Object.values(StatusPedido)
    .filter((status) => (contagem.get(status) ?? 0) > 0)
    .map((status) => `${contagem.get(status)} ${STATUS_LABEL[status]}`)
    .join(" · ");
}

export default function AdminDashboardPage() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [pedidosErro, setPedidosErro] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [produtosErro, setProdutosErro] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [categoriasErro, setCategoriasErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    Promise.allSettled([listarPedidos(), listarProdutos(), listarCategorias()]).then(
      ([resPedidos, resProdutos, resCategorias]) => {
        if (cancelado) return;

        if (resPedidos.status === "fulfilled") {
          setPedidos(resPedidos.value);
        } else {
          setPedidosErro(getErrorMessage(resPedidos.reason, "Não foi possível carregar."));
        }

        if (resProdutos.status === "fulfilled") {
          setProdutos(resProdutos.value);
        } else {
          setProdutosErro(getErrorMessage(resProdutos.reason, "Não foi possível carregar."));
        }

        if (resCategorias.status === "fulfilled") {
          setCategorias(resCategorias.value);
        } else {
          setCategoriasErro(getErrorMessage(resCategorias.reason, "Não foi possível carregar."));
        }
      },
    );

    return () => {
      cancelado = true;
    };
  }, []);

  // Faturamento — soma de pedido.total só entre os pagos (PENDENTE/
  // CANCELADO/REEMBOLSO_SOLICITADO/REEMBOLSADO ficam de fora de propósito,
  // ver Etapa 6.6). `null` só enquanto pedidos ainda não chegou (loading/
  // erro) — lista vazia (ou sem nenhum PAGO) já é `[]`, então a soma dá 0
  // (R$ 0,00), nunca null.
  const pedidosPagos = pedidos?.filter((pedido) => pedido.status === StatusPedido.PAGO) ?? null;
  const faturamento = pedidosPagos
    ? pedidosPagos.reduce((soma, pedido) => soma + pedido.total, 0)
    : null;
  const produtosAtivos = produtos?.filter((produto) => produto.ativo).length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-brand-navy">Dashboard Sensora</h2>
        <p className="text-sm text-slate-600">Visão geral da loja.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Visão geral
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            titulo="Faturamento"
            loading={pedidos === null && !pedidosErro}
            erro={pedidosErro ?? undefined}
            valor={faturamento !== null ? formatPrice.format(faturamento) : undefined}
            descricao={pedidosPagos ? `${pedidosPagos.length} pedidos pagos` : undefined}
          />
          <MetricCard
            titulo="Pedidos"
            loading={pedidos === null && !pedidosErro}
            erro={pedidosErro ?? undefined}
            valor={pedidos ? String(pedidos.length) : undefined}
            descricao={pedidos ? descricaoPorStatus(pedidos) : undefined}
          />
          <MetricCard
            titulo="Produtos"
            loading={produtos === null && !produtosErro}
            erro={produtosErro ?? undefined}
            valor={produtos ? String(produtos.length) : undefined}
            descricao={
              produtos
                ? produtos.length === 0
                  ? "Nenhum produto cadastrado"
                  : `${produtosAtivos} ativos`
                : undefined
            }
          />
          <MetricCard
            titulo="Categorias"
            loading={categorias === null && !categoriasErro}
            erro={categoriasErro ?? undefined}
            valor={categorias ? String(categorias.length) : undefined}
            descricao={categorias?.length === 0 ? "Nenhuma categoria cadastrada" : undefined}
          />
        </div>
      </section>
    </div>
  );
}
