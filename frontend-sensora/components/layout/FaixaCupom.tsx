"use client";

import { useEffect, useState } from "react";
import { buscarFaixaCupom } from "@/services/cupons";
import type { FaixaCupom } from "@/lib/types/loja";

const ALTURA = "2.25rem";

// Faixa fina acima do menu, no mesmo lugar da referência (texto centralizado,
// fundo claro). O primeiro valor vem do servidor; depois a conta logada
// pode trocar por um cupom só dela.
export default function FaixaCupom({ inicial }: { inicial: FaixaCupom | null }) {
  const [faixa, setFaixa] = useState(inicial);

  useEffect(() => {
    let vivo = true;
    buscarFaixaCupom()
      .then((atual) => {
        if (vivo) setFaixa(atual);
      })
      .catch(() => {
        // A faixa do servidor continua valendo se a atualização falhar.
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--faixa-cupom",
      faixa ? ALTURA : "0px",
    );
  }, [faixa]);

  if (!faixa) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-9 items-center justify-center bg-[#e8d7b8] px-4 text-center">
      <p className="truncate text-[11px] font-medium tracking-[0.14em] text-brand-navy uppercase sm:text-xs">
        {faixa.mensagem}
      </p>
    </div>
  );
}
