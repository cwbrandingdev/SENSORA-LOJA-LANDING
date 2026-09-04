// Portado de frontend/components/tables/PedidoTable.js — mesmo
// comportamento e colunas. O link "Ver itens" usa ROUTES.PEDIDOS, já
// portado em lib/routes.ts com o mesmo caminho (não movido ainda).
//
// Etapa 6.6 (Status de Envio) — ganhou a coluna "Envio": status logístico
// (NAO_ENVIADO/ENVIADO, independente da coluna "Status" financeira) + frete
// cotado no checkout (transportadora/serviço/valor — a auditoria encontrou
// esse dado já salvo no banco, mas nunca exibido no Admin) + o botão
// "Marcar como enviado", só para pedidos PAGO + NAO_ENVIADO.
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import FormButton from "@/components/ui/FormButton";
import EmptyState from "@/components/ui/EmptyState";
import { StatusEnvio, StatusPedido, type Pedido } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

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
};

export default function PedidoTable({
  pedidos,
  onEdit,
  onRemove,
  onMarcarEnviado,
  marcandoEnviadoId,
}: PedidoTableProps) {
  if (!pedidos || pedidos.length === 0) {
    return (
      <EmptyState
        compact
        eyebrow="Pedidos"
        title="Nenhum pedido cadastrado"
        message="Ainda não há pedidos registrados."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-brand-navy text-white">
            <th className="px-4 py-2 font-medium">Número</th>
            <th className="px-4 py-2 font-medium">Data</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Envio</th>
            <th className="px-4 py-2 font-medium">Total</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
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
              <tr key={pedido.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-4 py-2">{pedido.numero}</td>
                <td className="px-4 py-2">
                  {/* Achado da investigação (Editar pedido PENDENTE, Etapa
                      6.6) — `pedido.data` é meia-noite UTC; sem `timeZone:
                      "UTC"` aqui, toLocaleDateString converte para o fuso
                      local (ex.: America/Sao_Paulo, UTC-3) e exibe o dia
                      anterior, divergindo do valor real salvo (e do que o
                      próprio formulário de edição mostra, que lê a string ISO
                      diretamente sem passar por Date). */}
                  {new Date(pedido.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                </td>
                <td className="px-4 py-2">{pedido.status}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">
                      {pedido.statusEnvio === StatusEnvio.ENVIADO
                        ? "Enviado"
                        : "Aguardando envio"}
                    </span>
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
                <td className="px-4 py-2">{pedido.total}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`${ROUTES.PEDIDOS}/${pedido.id}`}
                      className="inline-flex items-center justify-center rounded-md border border-brand-navy px-3 py-2 text-sm font-medium text-brand-navy hover:bg-slate-50"
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
