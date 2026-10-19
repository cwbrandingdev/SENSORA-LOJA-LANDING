"use client";

import type { Endereco } from "@/lib/types/loja";

type EnderecoSelectProps = {
  enderecos: Endereco[];
  selecionadoId: number | null;
  onSelecionar: (id: number) => void;
};

function rotuloOpcao(endereco: Endereco): string {
  const linha = `${endereco.rua}, ${endereco.numero}`;
  return endereco.padrao ? `${linha} — Padrão` : linha;
}

export default function EnderecoSelect({
  enderecos,
  selecionadoId,
  onSelecionar,
}: EnderecoSelectProps) {
  const selecionado =
    enderecos.find((endereco) => endereco.id === selecionadoId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label
          htmlFor="checkout-endereco"
          className="text-sm font-medium text-slate-700"
        >
          Endereço salvo
        </label>
        <select
          id="checkout-endereco"
          aria-label="Selecione um endereço"
          value={selecionadoId ?? ""}
          onChange={(event) => onSelecionar(Number(event.target.value))}
          className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
        >
          {enderecos.map((endereco) => (
            <option key={endereco.id} value={endereco.id}>
              {rotuloOpcao(endereco)}
            </option>
          ))}
        </select>
      </div>

      {selecionado && (
        <div
          className="rounded-sm border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600"
          aria-live="polite"
        >
          <p className="font-medium text-brand-navy">
            {selecionado.rua}, {selecionado.numero}
            {selecionado.complemento ? ` — ${selecionado.complemento}` : ""}
          </p>
          <p className="mt-1">
            {selecionado.bairro} — {selecionado.cidade}/{selecionado.estado}
          </p>
          <p>CEP {selecionado.cep}</p>
        </div>
      )}
    </div>
  );
}
