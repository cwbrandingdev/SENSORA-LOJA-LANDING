// Portado de frontend/components/tables/PedidoTable.js — mesmo
// comportamento e colunas. O link "Ver itens" usa ROUTES.PEDIDOS, já
// portado em lib/routes.ts com o mesmo caminho (não movido ainda).
//
// Etapa 6.6 (Status de Envio) — ganhou a coluna "Envio": status logístico
// (NAO_ENVIADO/ENVIADO, independente da coluna "Status" financeira) + frete
// cotado no checkout (transportadora/serviço/valor — a auditoria encontrou
// esse dado já salvo no banco, mas nunca exibido no Admin) + o botão
// "Marcar como enviado", só para pedidos PAGO + NAO_ENVIADO.
//
// Refinamento visual (Admin) — cabeçalho claro (em vez de bg-brand-navy
// sólido) e Badge nos dois eixos de status, mesma receita de
// components/conta/StatusPedidoBadge.tsx generalizada em components/ui/
// Badge.tsx. Nenhum status novo, nenhuma coluna/ação removida.
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import FormButton from "@/components/ui/FormButton";
import EmptyState from "@/components/ui/EmptyState";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { StatusEnvio, StatusPedido, type Pedido } from "@/lib/types/loja";
import { ClipboardList } from "lucide-react";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Mesmos rótulos/cores de StatusPedidoBadge.tsx (components/conta) — REEMBOLSO_SOLICITADO/
// REEMBOLSADO usam tons próprios, nunca reaproveitando warning (PENDENTE)
// ou danger (CANCELADO).
const STATUS_LABEL: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "Pendente",
  [StatusPedido.PAGO]: "Pago",
  [StatusPedido.CANCELADO]: "Cancelado",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "Reembolso solicitado",
  [StatusPedido.REEMBOLSADO]: "Reembolsado",
};

const STATUS_TONE: Record<StatusPedido, BadgeTone> = {
  [StatusPedido.PENDENTE]: "warning",
  [StatusPedido.PAGO]: "success",
  [StatusPedido.CANCELADO]: "danger",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "info",
  [StatusPedido.REEMBOLSADO]: "neutral",
};

// `enviadoEm` é um instante real (`new Date()` no momento do clique em
// "Marcar como enviado"), não um dia de calendário como `pedido.data` — por
// isso usa o fuso America/Sao_Paulo aqui, nunca `timeZone: "UTC"` (ver
// comentário completo em lib/types/loja.ts#Pedido.enviadoEm).
function formatarDataEnvio(enviadoEm: string): string {
  return new Date(enviadoEm).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

type PedidoTableProps = {
  pedidos: Pedido[];
  onEdit: (pedido: Pedido) => void;
  onRemove: (pedido: Pedido) => void;
  onMarcarEnviado: (pedido: Pedido) => void;
  marcandoEnviadoId?: number | null;
  // Filtros (PedidosFiltros.tsx) — distingue "não há nenhum pedido
  // cadastrado" de "nenhum pedido corresponde ao filtro atual", para não
  // sugerir que a loja não tem pedido nenhum quando é só o filtro que não
  // encontrou nada. Default false preserva o texto original para quem
  // ainda não usa filtro nenhum.
  filtrosAtivos?: boolean;
};

export default function PedidoTable({
  pedidos,
  onEdit,
  onRemove,
  onMarcarEnviado,
  marcandoEnviadoId,
  filtrosAtivos = false,
}: PedidoTableProps) {
  if (!pedidos || pedidos.length === 0) {
    return filtrosAtivos ? (
      <EmptyState
        compact
        eyebrow="Pedidos"
        title="Nenhum pedido encontrado"
        message="Nenhum pedido corresponde aos filtros selecionados."
        icon={ClipboardList}
      />
    ) : (
      <EmptyState
        compact
        eyebrow="Pedidos"
        title="Nenhum pedido cadastrado"
        message="Ainda não há pedidos registrados."
        icon={ClipboardList}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Número
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Data
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Envio
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pedidos.map((pedido) => {
            const podeMarcarEnviado =
              pedido.status === StatusPedido.PAGO &&
              pedido.statusEnvio === StatusEnvio.NAO_ENVIADO;
            // Etapa 8.2 (HIGH-02 — hard-delete de pedido financeiramente
            // relevante) — só PENDENTE pode ser excluído (mesma regra que
            // o backend aplica de forma atômica em PedidosService.remove();
            // esconder o botão aqui é só UX, nunca a proteção real — uma
            // chamada direta a DELETE /pedidos/:id para qualquer outro
            // status continua sendo rejeitada com 409 pelo backend).
            const podeExcluir = pedido.status === StatusPedido.PENDENTE;
            const marcando = marcandoEnviadoId === pedido.id;
            const temFrete =
              pedido.freteTransportadora || pedido.freteServico || pedido.freteValor != null;

            return (
              <tr key={pedido.id} className="transition-colors hover:bg-slate-50/80">
                <td className="px-4 py-3 font-medium text-slate-900">{pedido.numero}</td>
                <td className="px-4 py-3 text-slate-600">
                  {/* Achado da investigação (Editar pedido PENDENTE, Etapa
                      6.6) — `pedido.data` é meia-noite UTC; sem `timeZone:
                      "UTC"` aqui, toLocaleDateString converte para o fuso
                      local (ex.: America/Sao_Paulo, UTC-3) e exibe o dia
                      anterior, divergindo do valor real salvo (e do que o
                      próprio formulário de edição mostra, que lê a string ISO
                      diretamente sem passar por Date). */}
                  {new Date(pedido.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[pedido.status]}>{STATUS_LABEL[pedido.status]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <Badge tone={pedido.statusEnvio === StatusEnvio.ENVIADO ? "info" : "warning"}>
                      {pedido.statusEnvio === StatusEnvio.ENVIADO ? "Enviado" : "Aguardando envio"}
                    </Badge>
                    {pedido.statusEnvio === StatusEnvio.ENVIADO && pedido.enviadoEm && (
                      <span className="text-xs text-slate-500">
                        {formatarDataEnvio(pedido.enviadoEm)}
                      </span>
                    )}
                    {/* Achado da auditoria (Etapa 6.6) — freteTransportadora/
                        freteServico/freteValor são a opção de frete COTADA no
                        checkout, não uma confirmação de envio; mostrados aqui
                        só como referência de qual serviço foi escolhido. */}
                    {temFrete && (
                      <span className="text-xs text-slate-400">
                        {[pedido.freteTransportadora, pedido.freteServico]
                          .filter(Boolean)
                          .join(" · ")}
                        {pedido.freteValor != null &&
                          ` · ${formatPrice.format(pedido.freteValor)}`}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{pedido.total}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`${ROUTES.PEDIDOS}/${pedido.id}`}
                      className="inline-flex items-center justify-center rounded-md border border-brand-navy px-3 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                    >
                      Ver itens
                    </Link>
                    <FormButton variant="secondary" onClick={() => onEdit(pedido)}>
                      Editar
                    </FormButton>
                    {podeExcluir && (
                      <FormButton variant="danger" onClick={() => onRemove(pedido)}>
                        Remover
                      </FormButton>
                    )}
                    {podeMarcarEnviado && (
                      <FormButton
                        variant="primary"
                        disabled={marcando}
                        onClick={() => onMarcarEnviado(pedido)}
                      >
                        {marcando ? "Marcando..." : "Marcar como enviado"}
                      </FormButton>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
