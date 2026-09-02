"use client";

// Etapa 6.5 (Frete) — seção "Entrega" do checkout. Mesmo padrão visual e de
// acessibilidade de EnderecoCard (botão nativo com role="radio", radiogroup
// no pai) — nenhum componente/biblioteca nova, só reaproveita o vocabulário
// visual já usado para endereço. O preço/prazo exibidos aqui vêm sempre da
// última cotação retornada pelo backend (services/frete.ts) — o componente
// em si não calcula nada.
import FreteOptionsSkeleton from "./FreteOptionsSkeleton";
import type { OpcaoFrete } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatarPrazo(prazoDias: number): string {
  return prazoDias === 1 ? "1 dia útil" : `${prazoDias} dias úteis`;
}

type FreteOptionsProps = {
  carregando: boolean;
  erro: string | null;
  opcoes: OpcaoFrete[];
  selecionadoId: number | null;
  onSelecionar: (opcao: OpcaoFrete) => void;
  onTentarNovamente: () => void;
};

export default function FreteOptions({
  carregando,
  erro,
  opcoes,
  selecionadoId,
  onSelecionar,
  onTentarNovamente,
}: FreteOptionsProps) {
  if (carregando) {
    return <FreteOptionsSkeleton />;
  }

  if (erro) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-sm border border-red-200 bg-red-50 px-6 py-8 text-center">
        <p className="text-sm text-red-700">{erro}</p>
        <button
          type="button"
          onClick={onTentarNovamente}
          className="text-[13px] font-semibold uppercase tracking-[0.14em] text-red-700 underline underline-offset-4 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (opcoes.length === 0) {
    return (
      <p className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
        Nenhuma opção de frete disponível para este endereço no momento.
      </p>
    );
  }

  return (
    <div
      className="flex flex-col gap-3"
      role="radiogroup"
      aria-label="Selecione uma opção de frete"
    >
      {opcoes.map((opcao) => {
        const selecionado = opcao.id === selecionadoId;
        return (
          <button
            key={opcao.id}
            type="button"
            role="radio"
            aria-checked={selecionado}
            onClick={() => onSelecionar(opcao)}
            className={`flex w-full items-center justify-between gap-3 rounded-sm border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 ${
              selecionado
                ? "border-brand-navy bg-brand-navy/5"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  selecionado ? "border-brand-navy" : "border-slate-300"
                }`}
              >
                {selecionado && <span className="h-2 w-2 rounded-full bg-brand-navy" />}
              </span>
              <div className="text-sm">
                <p className="font-medium text-brand-navy">
                  {opcao.transportadora} — {opcao.servico}
                </p>
                <p className="mt-1 text-slate-500">{formatarPrazo(opcao.prazoDias)}</p>
              </div>
            </div>

            <p className="shrink-0 text-sm font-semibold tabular-nums text-brand-navy">
              {formatPrice.format(opcao.preco)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
