"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LINK_COLECAO_NATAL, PRAZO_PEDIDOS_NATAL } from "@/lib/tema-natal";

// Áreas de compra/conta: sem faixa, para não distrair quem está pagando.
const SEM_FAIXA = ["/loja/carrinho", "/loja/checkout", "/checkout", "/conta"];

// Faixa fina de Natal no topo das páginas da loja. Na home não aparece (lá
// já tem a faixa grande) — escondida por CSS via .tema-natal-home, porque
// na Vercel a home é gerada com pathname "/index" (ver SiteMain).
export default function FaixaNatalTopo() {
  const pathname = usePathname() ?? "";
  if (SEM_FAIXA.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
    return null;
  }
  const naPaginaDaColecao = pathname === LINK_COLECAO_NATAL;

  return (
    <div className="natal-faixa-topo bg-brand-navy px-4 py-2.5 text-center text-[11px] tracking-[0.12em] text-white/85 sm:text-xs">
      <span className="text-[#d9b36c]">✦</span>
      <span className="mx-2 font-semibold uppercase tracking-[0.25em] text-[#d9b36c]">Especial de Natal</span>
      {PRAZO_PEDIDOS_NATAL && (
        <span className="hidden sm:inline">
          · Peça até <strong className="font-semibold text-white">{PRAZO_PEDIDOS_NATAL}</strong> para receber antes do
          Natal
        </span>
      )}
      {!naPaginaDaColecao && (
        <Link
          href={LINK_COLECAO_NATAL}
          className="ml-2 font-semibold uppercase tracking-[0.2em] text-white underline-offset-4 hover:underline"
        >
          Ver coleção →
        </Link>
      )}
      <span className="ml-2 text-[#d9b36c]">✦</span>
    </div>
  );
}
