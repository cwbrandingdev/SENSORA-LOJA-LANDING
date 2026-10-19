"use client";

// Estrelas de 1 a 5: só exibição (`valor`, aceita média quebrada como 4,6)
// ou escolha da nota (`onEscolher`, botões de rádio acessíveis).
import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type EstrelasProps = {
  valor: number;
  tamanho?: "sm" | "md" | "lg";
  /** Quando passado, as estrelas viram a escolha da nota. */
  onEscolher?: (nota: number) => void;
  className?: string;
};

const TAMANHO = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-7 w-7" };
const ROTULO_NOTA = ["", "Ruim", "Regular", "Bom", "Muito bom", "Excelente"];

export default function Estrelas({ valor, tamanho = "md", onEscolher, className }: EstrelasProps) {
  const [sobre, setSobre] = useState<number | null>(null);

  if (!onEscolher) {
    return (
      <span
        role="img"
        aria-label={`${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de 5 estrelas`}
        className={cn("inline-flex items-center gap-0.5", className)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          // Parte preenchida desta estrela (0 a 100%), para médias quebradas.
          const cheia = Math.max(0, Math.min(1, valor - (n - 1))) * 100;
          return (
            <span key={n} className="relative inline-flex">
              <Star aria-hidden className={cn(TAMANHO[tamanho], "text-slate-300")} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${cheia}%` }}>
                <Star aria-hidden className={cn(TAMANHO[tamanho], "fill-brand-orange text-brand-orange")} />
              </span>
            </span>
          );
        })}
      </span>
    );
  }

  const mostrada = sobre ?? valor;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div role="radiogroup" aria-label="Sua nota" className="flex" onMouseLeave={() => setSobre(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor === n}
            aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"} — ${ROTULO_NOTA[n]}`}
            onClick={() => onEscolher(n)}
            onMouseEnter={() => setSobre(n)}
            className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:outline-none"
          >
            <Star
              aria-hidden
              className={cn(
                TAMANHO[tamanho],
                n <= mostrada ? "fill-brand-orange text-brand-orange" : "text-slate-300",
              )}
            />
          </button>
        ))}
      </div>
      {mostrada > 0 && <span className="text-sm text-slate-600">{ROTULO_NOTA[mostrada]}</span>}
    </div>
  );
}
