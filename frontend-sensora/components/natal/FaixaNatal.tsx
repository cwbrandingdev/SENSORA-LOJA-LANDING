"use client";

import Link from "next/link";
import { ArrowRight, Sparkle } from "lucide-react";
import { LINK_COLECAO_NATAL, PRAZO_PEDIDOS_NATAL } from "@/lib/tema-natal";

// Bolas de Natal penduradas no topo da faixa (posição, altura do fio, cor).
const BOLAS = [
  { lado: "left-[4%]", fio: 34, cor: "#a8322d", tamanho: 26, atraso: "0s" },
  { lado: "left-[9%]", fio: 62, cor: "#d9b36c", tamanho: 20, atraso: "1.2s" },
  { lado: "right-[9%]", fio: 48, cor: "#d9b36c", tamanho: 22, atraso: "0.6s" },
  { lado: "right-[4%]", fio: 24, cor: "#a8322d", tamanho: 28, atraso: "1.8s" },
];

// Dias até o próximo 25/12 (0 no próprio dia; depois dele, null).
function diasAteONatal(): number | null {
  const hoje = new Date();
  const natal = new Date(hoje.getFullYear(), 11, 25);
  const inicioDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((natal.getTime() - inicioDeHoje.getTime()) / 86_400_000);
  return dias >= 0 ? dias : null;
}

// Posições fixas das estrelinhas (não aleatórias, para o servidor e o
// navegador desenharem igual).
const ESTRELAS = [
  { left: "6%", top: "28%", tamanho: 10, atraso: "0s" },
  { left: "14%", top: "68%", tamanho: 7, atraso: "1.1s" },
  { left: "27%", top: "22%", tamanho: 6, atraso: "2.2s" },
  { left: "73%", top: "70%", tamanho: 6, atraso: "0.6s" },
  { left: "86%", top: "26%", tamanho: 9, atraso: "1.7s" },
  { left: "94%", top: "64%", tamanho: 7, atraso: "2.6s" },
];

// Faixa logo abaixo do banner: chamada da coleção + contagem regressiva.
export default function FaixaNatal() {
  const dias = diasAteONatal();
  let contagem = "Boas festas!";
  if (dias === 0) contagem = "É hoje! Feliz Natal";
  else if (dias === 1) contagem = "Falta 1 dia para o Natal";
  else if (dias !== null) contagem = `Faltam ${dias} dias para o Natal`;

  return (
    <section aria-label="Especial de Natal" className="relative overflow-hidden bg-brand-navy text-white">
      {ESTRELAS.map((estrela, indice) => (
        <Sparkle
          key={indice}
          aria-hidden
          className="natal-estrela absolute fill-[#d9b36c] text-[#d9b36c]"
          style={{
            left: estrela.left,
            top: estrela.top,
            width: estrela.tamanho * 2,
            height: estrela.tamanho * 2,
            animationDelay: estrela.atraso,
          }}
        />
      ))}

      {BOLAS.map((bola, indice) => (
        <div
          key={indice}
          aria-hidden
          className={`natal-bola absolute top-0 hidden flex-col items-center sm:flex ${bola.lado}`}
          style={{ animationDelay: bola.atraso }}
        >
          <span className="w-px bg-[#d9b36c]/60" style={{ height: bola.fio }} />
          <span className="h-1.5 w-2 rounded-t-sm bg-[#d9b36c]" />
          <span
            className="rounded-full"
            style={{
              width: bola.tamanho,
              height: bola.tamanho,
              background: `radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.55), ${bola.cor} 45%, rgb(0 0 0 / 0.35))`,
            }}
          />
        </div>
      ))}

      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-10 text-center sm:py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#d9b36c]" suppressHydrationWarning>
          {contagem}
        </p>
        <h2 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">
          Presentes que perfumam o <span className="italic text-[#d9b36c]">Natal</span>
        </h2>
        <span aria-hidden className="h-px w-16 bg-[#d9b36c]/60" />
        <Link
          href={LINK_COLECAO_NATAL}
          className="group inline-flex items-center gap-2 border border-[#d9b36c]/70 px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#d9b36c] transition-colors duration-300 hover:bg-[#d9b36c] hover:text-brand-navy"
        >
          Ver coleção de Natal
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
        </Link>
        {PRAZO_PEDIDOS_NATAL && dias !== null && (
          <p className="text-xs text-white/70">
            Peça até <strong className="font-semibold text-white">{PRAZO_PEDIDOS_NATAL}</strong> para receber antes do
            Natal.
          </p>
        )}
      </div>
    </section>
  );
}
