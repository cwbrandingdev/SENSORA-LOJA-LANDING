"use client";

// Extraído de AddToCartControls (Task 1) para ser reaproveitado também nas
// linhas do carrinho (Task 2) — mesmo controle visual/comportamental nos
// dois lugares, sem duplicar a marcação do stepper.
type QuantityStepperProps = {
  value: number;
  onIncrease: () => void;
  onDecrease: () => void;
  min?: number;
  /** Etapa 6.6 (aviso de estoque) — quando definido, "+" desabilita ao
   *  atingir esse limite (estoque conhecido pelo frontend, nunca uma
   *  validação real — essa continua só no backend). Omitido preserva o
   *  comportamento anterior (sem teto). */
  max?: number;
  /** Etapa 6.6 — desabilita os dois botões de uma vez (ex.: estoque
   *  esgotado), sem exigir que quem chama zere min/max para simular isso. */
  disabled?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
};

export default function QuantityStepper({
  value,
  onIncrease,
  onDecrease,
  min = 1,
  max,
  disabled = false,
  decreaseLabel = "Diminuir quantidade",
  increaseLabel = "Aumentar quantidade",
}: QuantityStepperProps) {
  const noLimiteMaximo = typeof max === "number" && value >= max;

  return (
    <div className="inline-flex items-center rounded-full border border-slate-300">
      <button
        type="button"
        onClick={onDecrease}
        disabled={disabled || value <= min}
        aria-label={decreaseLabel}
        className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-brand-navy transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        −
      </button>
      <span
        aria-live="polite"
        className="w-8 text-center text-sm font-semibold tabular-nums text-brand-navy"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={disabled || noLimiteMaximo}
        aria-label={increaseLabel}
        className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-brand-navy transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        +
      </button>
    </div>
  );
}
