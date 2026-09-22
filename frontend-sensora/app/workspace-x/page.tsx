"use client";

// Client Component (não Server Component) pelo mesmo motivo de todas as
// outras páginas de /workspace-x/** (Etapa 8.12, antes /admin/**): o Next
// só evita renderizar o conteúdo de uma
// página no servidor — e portanto no HTML/RSC inicial, antes de
// ProtectedLayout decidir se autoriza o acesso — quando ela é "use client".
// Achado da auditoria: como Server Component, este dashboard era a única
// página do admin cujo conteúdo (ainda que só texto estático) chegava no
// payload de uma requisição não autenticada.
//
// Vistoria do Dashboard operacional (Admin) — os 6 cards passam a consumir
// UM ÚNICO GET /dashboard/resumo (backend/src/dashboard/), já agregado no
// banco (count/groupBy), em vez das 3 chamadas anteriores (GET /pedidos,
// /produtos, /categorias) somadas em memória aqui no cliente. Os 4 cards de
// "Visão geral" continuam mostrando exatamente os mesmos números de antes —
// só a origem do dado mudou. `resumo === null && !erro` é o único estado de
// loading agora (uma única requisição, não 3 independentes): todo card
// compartilha o mesmo loading/erro, o que já reflete a realidade (não há
// mais como um card carregar e outro falhar). Faturamento/Pedidos/Produtos/
// Categorias/Estoque/Clientes vazios (nenhum registro) são estados
// legítimos, distintos de erro — nunca tratados como falha (ver
// DashboardService.obterResumo, backend).
import { useEffect, useState } from "react";
import { Wallet, ClipboardList, Package, Tags, PackageX, Users } from "lucide-react";
import MetricCard from "@/components/admin/MetricCard";
import { getErrorMessage } from "@/lib/errors";
import { buscarResumoDashboard } from "@/services/dashboard";
import { StatusPedido, type DashboardResumo } from "@/lib/types/loja";

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
// pedido aparecem, na mesma ordem de StatusPedido. `porStatus` já vem do
// backend com as 5 chaves sempre presentes (0 quando vazio) — nenhum pedido
// registrado é um estado legítimo ("Nenhum pedido registrado"), não um erro.
function descricaoPorStatus(porStatus: Record<StatusPedido, number>): string {
  const partes = Object.values(StatusPedido)
    .filter((status) => porStatus[status] > 0)
    .map((status) => `${porStatus[status]} ${STATUS_LABEL[status]}`);

  return partes.length > 0 ? partes.join(" · ") : "Nenhum pedido registrado";
}

export default function AdminDashboardPage() {
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    buscarResumoDashboard()
      .then((dados) => {
        if (!cancelado) setResumo(dados);
      })
      .catch((motivo) => {
        if (!cancelado) setErro(getErrorMessage(motivo, "Não foi possível carregar."));
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const loading = resumo === null && !erro;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-brand-navy">Dashboard Sensora</h2>
        <p className="text-sm text-slate-600">Visão geral da loja.</p>
      </div>

      <section className="flex flex-col gap-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Visão geral
        </h3>
        {/* lg:grid-cols-5 — Faturamento ocupa 2 colunas (destaque) e os 3
            secundários ocupam 1 cada, somando 5, sem sobra na mesma linha.
            No mobile (grid-cols-1) e tablet (sm:grid-cols-2) o col-span-2 do
            destaque continua válido e empilha naturalmente. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2">
            <MetricCard
              titulo="Faturamento"
              icon={Wallet}
              destaque
              loading={loading}
              erro={erro ?? undefined}
              valor={resumo ? formatPrice.format(resumo.faturamento) : undefined}
              descricao={resumo ? `${resumo.pedidos.pagos} pedidos pagos` : undefined}
            />
          </div>
          <MetricCard
            titulo="Pedidos"
            icon={ClipboardList}
            iconTone="navy"
            loading={loading}
            erro={erro ?? undefined}
            valor={resumo ? String(resumo.pedidos.total) : undefined}
            descricao={resumo ? descricaoPorStatus(resumo.pedidos.porStatus) : undefined}
          />
          <MetricCard
            titulo="Produtos"
            icon={Package}
            iconTone="orange-outline"
            loading={loading}
            erro={erro ?? undefined}
            valor={resumo ? String(resumo.produtos.total) : undefined}
            descricao={
              resumo
                ? resumo.produtos.total === 0
                  ? "Nenhum produto cadastrado"
                  : `${resumo.produtos.ativos} ativos`
                : undefined
            }
          />
          <MetricCard
            titulo="Categorias"
            icon={Tags}
            iconTone="navy-outline"
            loading={loading}
            erro={erro ?? undefined}
            valor={resumo ? String(resumo.categorias.total) : undefined}
            descricao={resumo?.categorias.total === 0 ? "Nenhuma categoria cadastrada" : undefined}
          />
        </div>
      </section>

      {/* Vistoria do Dashboard operacional (Admin) — segunda seção, separada
          de "Visão geral" de propósito: os 4 cards originais continuam
          exatamente como estavam (mesmo grid, mesma ordem, mesmo destaque),
          esta é uma adição, não uma reorganização. Estoque baixo/zerado
          (Produto.quantidade, ver LIMIAR_ESTOQUE_BAIXO no backend) e
          Clientes reais (Usuario perfil CLIENTE — nunca o model `Cliente`
          legado) são as duas métricas pedidas na vistoria. */}
      <section className="flex flex-col gap-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Operacional
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            titulo="Estoque baixo"
            icon={PackageX}
            iconTone="orange-outline"
            loading={loading}
            erro={erro ?? undefined}
            valor={
              resumo
                ? String(resumo.produtos.estoqueBaixo + resumo.produtos.semEstoque)
                : undefined
            }
            descricao={
              resumo
                ? resumo.produtos.semEstoque > 0
                  ? `${resumo.produtos.semEstoque} sem estoque`
                  : "Nenhum produto sem estoque"
                : undefined
            }
          />
          <MetricCard
            titulo="Clientes"
            icon={Users}
            iconTone="navy-outline"
            loading={loading}
            erro={erro ?? undefined}
            valor={resumo ? String(resumo.clientes.total) : undefined}
            descricao={
              resumo
                ? resumo.clientes.total === 0
                  ? "Nenhum cliente cadastrado"
                  : `${resumo.clientes.ativos} ativos`
                : undefined
            }
          />
        </div>
      </section>
    </div>
  );
}
