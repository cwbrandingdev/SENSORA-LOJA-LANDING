// Etapa 2 (Minha Conta / Acompanhar Pedido) — usa SOMENTE o dado que
// realmente existe hoje (Pedido.status: PENDENTE | PAGO | CANCELADO). Nenhum
// rastreio de transportadora/código/etapa logística é inventado — o schema
// não tem esses campos (ver auditoria da Etapa 2). A lista de `etapas` é a
// estrutura pensada para crescer: quando existir rastreio real (nova coluna/
// integração), as etapas de envio/entrega entram como itens novos no array
// devolvido por montarEtapas, sem precisar redesenhar este componente.
import { StatusPedido } from "@/lib/types/loja";

type Etapa = {
  label: string;
  alcancada: boolean;
  atual: boolean;
};

function montarEtapas(status: StatusPedido): Etapa[] {
  if (status === StatusPedido.CANCELADO) {
    return [
      { label: "Pedido realizado", alcancada: true, atual: false },
      { label: "Cancelado", alcancada: true, atual: true },
    ];
  }

  const pago = status === StatusPedido.PAGO;
  return [
    { label: "Pedido realizado", alcancada: true, atual: !pago },
    { label: "Pagamento confirmado", alcancada: pago, atual: pago },
  ];
}

export default function AcompanhamentoPedido({ status }: { status: StatusPedido }) {
  const etapas = montarEtapas(status);
  const cancelado = status === StatusPedido.CANCELADO;

  return (
    <div>
      <ol className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0">
        {etapas.map((etapa, index) => (
          <li key={etapa.label} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center">
            <div className="flex items-center gap-3 sm:w-full sm:flex-col sm:gap-2">
              <span
                aria-hidden
                className={`flex h-3 w-3 shrink-0 rounded-full ${
                  etapa.alcancada
                    ? cancelado && etapa.atual
                      ? "bg-red-500"
                      : "bg-brand-orange"
                    : "bg-slate-200"
                }`}
              />
              {index < etapas.length - 1 && (
                <span
                  aria-hidden
                  className="hidden h-px flex-1 bg-slate-200 sm:block"
                />
              )}
            </div>
            <p
              className={`text-sm ${
                etapa.atual
                  ? "font-semibold text-brand-navy"
                  : etapa.alcancada
                    ? "text-slate-600"
                    : "text-slate-400"
              }`}
            >
              {etapa.label}
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        Ainda não temos informações de envio/rastreio disponíveis para este
        pedido.
      </p>
    </div>
  );
}
