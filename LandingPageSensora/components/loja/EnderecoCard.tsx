"use client";

import type { Endereco } from "@/lib/types/loja";

type EnderecoCardProps = {
  endereco: Endereco;
  selecionado: boolean;
  onSelecionar: () => void;
};

// Botão nativo (não <div onClick>) para foco/teclado funcionarem de graça —
// Enter/Espaço já ativam um <button> sem nenhum handler extra.
export default function EnderecoCard({ endereco, selecionado, onSelecionar }: EnderecoCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionado}
      onClick={onSelecionar}
      className={`flex w-full items-start justify-between gap-3 rounded-sm border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 ${
        selecionado
          ? "border-brand-navy bg-brand-navy/5"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Task 18: min-w-0 — evita que um complemento/rua muito longo force
          overflow dentro do botão flex. */}
      <div className="min-w-0 text-sm">
        <p className="font-medium text-brand-navy">
          {endereco.rua}, {endereco.numero}
          {endereco.complemento ? ` — ${endereco.complemento}` : ""}
        </p>
        <p className="mt-1 text-slate-500">
          {endereco.bairro} — {endereco.cidade}/{endereco.estado}
        </p>
        <p className="text-slate-500">CEP {endereco.cep}</p>
        {endereco.padrao && (
          <span className="mt-2 inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-orange">
            Padrão
          </span>
        )}
      </div>

      <span
        aria-hidden
        className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
          selecionado ? "border-brand-navy" : "border-slate-300"
        }`}
      >
        {selecionado && <span className="h-2 w-2 rounded-full bg-brand-navy" />}
      </span>
    </button>
  );
}
