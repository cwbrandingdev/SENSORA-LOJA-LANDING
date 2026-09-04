"use client";

// Etapa 2 (Minha Conta / Acompanhar Pedido) — usa SOMENTE o dado que
// realmente existe (Pedido.status). A lista de `etapas` foi pensada desde o
// início para crescer: quando existir uma etapa logística real, ela entra
// como item novo no array devolvido por montarEtapas, sem precisar
// redesenhar este componente — é exatamente o que a Etapa 6.6 (Status de
// Envio) faz agora, acrescentando uma 3ª etapa só no ramo PAGO. Ainda não
// inventa rastreio de transportadora/código — isso continua fora do schema
// (ver auditoria da Etapa 6.6).
import { useEffect, useState } from "react";
import { StatusEnvio, StatusPedido } from "@/lib/types/loja";

type Etapa = {
  label: string;
  alcancada: boolean;
  atual: boolean;
};

function montarEtapas(status: StatusPedido, statusEnvio: StatusEnvio): Etapa[] {
  if (status === StatusPedido.CANCELADO) {
    return [
      { label: "Pedido realizado", alcancada: true, atual: false },
      { label: "Cancelado", alcancada: true, atual: true },
    ];
  }

  // Etapa 5B.7 — pedido que chegou a ser pago não pode "voltar" a mostrar
  // "Pagamento confirmado" como etapa atual/pendente: ambos os estados de
  // reembolso só existem depois de PAGO, então as duas primeiras etapas
  // sempre aparecem alcançadas, e o reembolso continua a linha do tempo em
  // vez de reiniciá-la. Envio deliberadamente NÃO entra aqui: um pedido em
  // reembolso não tem uma etapa de "aguardando envio/enviado" fazendo
  // sentido junto da linha do tempo de estorno.
  if (
    status === StatusPedido.REEMBOLSO_SOLICITADO ||
    status === StatusPedido.REEMBOLSADO
  ) {
    const reembolsado = status === StatusPedido.REEMBOLSADO;
    return [
      { label: "Pedido realizado", alcancada: true, atual: false },
      { label: "Pagamento confirmado", alcancada: true, atual: false },
      { label: "Reembolso solicitado", alcancada: true, atual: !reembolsado },
      { label: "Reembolsado", alcancada: reembolsado, atual: reembolsado },
    ];
  }

  if (status !== StatusPedido.PAGO) {
    // PENDENTE (comportamento idêntico ao anterior à Etapa 6.6) — envio
    // nunca é uma etapa possível antes do pagamento ser confirmado.
    return [
      { label: "Pedido realizado", alcancada: true, atual: true },
      { label: "Pagamento confirmado", alcancada: false, atual: false },
    ];
  }

  // Etapa 6.6 (Status de Envio) — só aparece para pedidos PAGO. Eixo
  // logístico independente do financeiro: `statusEnvio` é quem decide o
  // rótulo/estado desta 3ª etapa, nunca `status`.
  const enviado = statusEnvio === StatusEnvio.ENVIADO;
  return [
    { label: "Pedido realizado", alcancada: true, atual: false },
    { label: "Pagamento confirmado", alcancada: true, atual: !enviado },
    {
      label: enviado ? "Pedido enviado" : "Aguardando envio",
      alcancada: enviado,
      atual: enviado,
    },
  ];
}

// `enviadoEm` é um instante real (`new Date()` no momento em que o admin
// marcou o pedido como enviado), não um dia de calendário como
// `pedido.data` — usa o fuso America/Sao_Paulo, nunca `timeZone: "UTC"`
// (mesma ressalva documentada em lib/types/loja.ts#Pedido.enviadoEm e em
// components/tables/PedidoTable.tsx).
function formatarDataEnvio(enviadoEm: string): string {
  return new Date(enviadoEm).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

type AcompanhamentoPedidoProps = {
  status: StatusPedido;
  statusEnvio: StatusEnvio;
  enviadoEm?: string | null;
};

export default function AcompanhamentoPedido({
  status,
  statusEnvio,
  enviadoEm,
}: AcompanhamentoPedidoProps) {
  const etapas = montarEtapas(status, statusEnvio);
  const cancelado = status === StatusPedido.CANCELADO;

  // Etapa 6.1 (Refinamento) — a barra entre duas etapas "desenha" da
  // esquerda para a direita quando a transição já foi alcançada, em vez de
  // aparecer pronta: comunica progressão, não é só decoração (item 13 da
  // etapa). Dispara uma vez, no mount (nunca em loop) — motion-reduce troca
  // para o estado final sem transição.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div>
      <ol className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0">
        {etapas.map((etapa, index) => {
          const proximaAlcancada = index < etapas.length - 1 && etapas[index + 1].alcancada;
          return (
            <li
              key={etapa.label}
              className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center"
            >
              <div className="flex items-center gap-3 sm:w-full sm:flex-col sm:gap-2">
                <span
                  aria-hidden
                  className={`flex h-3 w-3 shrink-0 rounded-full transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                    etapa.alcancada
                      ? cancelado && etapa.atual
                        ? "bg-red-500"
                        : "bg-brand-orange"
                      : "bg-slate-200"
                  } ${mounted ? "scale-100" : "scale-75"}`}
                />
                {index < etapas.length - 1 && (
                  <span
                    aria-hidden
                    className="relative hidden h-px flex-1 overflow-hidden bg-slate-200 sm:block"
                  >
                    <span
                      className={`absolute inset-0 origin-left bg-brand-orange transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                        mounted && proximaAlcancada ? "scale-x-100" : "scale-x-0"
                      }`}
                    />
                  </span>
                )}
              </div>
              <p
                className={`text-sm transition-colors duration-500 ${
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
          );
        })}
      </ol>

      {statusEnvio === StatusEnvio.ENVIADO && enviadoEm ? (
        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          Enviado em {formatarDataEnvio(enviadoEm)}. Ainda não temos código de
          rastreio disponível para este pedido.
        </p>
      ) : (
        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          Ainda não temos informações de envio/rastreio disponíveis para este
          pedido.
        </p>
      )}
    </div>
  );
}
