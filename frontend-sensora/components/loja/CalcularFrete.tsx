"use client";

// Calcula o frete na página do produto: a pessoa digita o CEP e vê as
// opções para 1 unidade. É só uma prévia; o valor final sai no checkout.
import { useState, type FormEvent } from "react";
import { ArrowRight, Truck } from "lucide-react";
import { formatarPrazo } from "./FreteOptions";
import { cepCompleto, formatarCep, normalizarCep } from "@/lib/cep";
import { getErrorMessage } from "@/lib/errors";
import type { OpcaoFrete } from "@/lib/types/loja";
import { cotarFreteDoProduto } from "@/services/frete";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function CalcularFrete({ produtoId }: { produtoId: number }) {
  const [cep, setCep] = useState("");
  const [opcoes, setOpcoes] = useState<OpcaoFrete[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function calcular(evento: FormEvent) {
    evento.preventDefault();
    setCarregando(true);
    setErro(null);
    setOpcoes([]);

    try {
      const resultado = await cotarFreteDoProduto(produtoId, normalizarCep(cep));
      setOpcoes(resultado);
    } catch (error) {
      setErro(getErrorMessage(error, "Não foi possível calcular o frete."));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={calcular} className="mt-8">
      <label htmlFor="cep-frete" className="flex items-center gap-2 text-sm text-slate-600">
        <Truck className="h-4 w-4 text-brand-orange" aria-hidden />
        Quanto custa para chegar até você?
      </label>

      {/* Só uma linha embaixo do campo; o botão é texto com seta. */}
      <div className="mt-2 flex max-w-sm items-center gap-4 border-b border-slate-300 transition-colors focus-within:border-brand-navy">
        <input
          id="cep-frete"
          inputMode="numeric"
          autoComplete="off"
          placeholder="00000-000"
          value={cep}
          onChange={(evento) => setCep(formatarCep(evento.target.value))}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-lg tabular-nums text-brand-navy outline-none placeholder:text-slate-300"
        />
        <button
          type="submit"
          disabled={!cepCompleto(cep) || carregando}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-orange transition-colors hover:text-brand-navy disabled:text-slate-300"
        >
          {carregando ? "Calculando..." : "Calcular"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}

      {opcoes.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200 text-[15px]">
          {opcoes.map((opcao) => (
            <li key={opcao.id} className="flex justify-between gap-6 py-2.5">
              <span className="text-slate-500">
                {opcao.servico} · {formatarPrazo(opcao.prazoDias)}
              </span>
              <span className="font-medium text-brand-navy">
                {formatPrice.format(opcao.preco)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
