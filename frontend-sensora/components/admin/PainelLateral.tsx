"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/** Painel lateral à direita para formulários do Admin (mesmo visual do
 *  formulário de produto). Fecha pelo X, clicando fora ou com Esc. */
export default function PainelLateral({
  rotulo,
  onFechar,
  children,
}: {
  rotulo: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={rotulo}>
      <button type="button" aria-label="Fechar formulário" className="absolute inset-0 bg-slate-900/40" onClick={onFechar} />
      <div className="relative ml-auto h-full w-full max-w-lg overflow-y-auto bg-slate-50 p-4 shadow-2xl sm:rounded-xl">
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-500 hover:bg-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pt-8">{children}</div>
      </div>
    </div>
  );
}
