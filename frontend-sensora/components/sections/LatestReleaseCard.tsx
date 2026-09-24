"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { statusEstoque } from "@/lib/estoque";
import type { ProdutoPublico } from "@/lib/api-publica";

export type ReleaseItem = {
  key: string;
  nome: string;
  href: string;
  imagemUrl?: string;
  preco?: number;
  lancamento?: boolean;
  produto?: ProdutoPublico;
};

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function LatestReleaseCard({ produto }: { produto: ReleaseItem }) {
  const { adicionarItem } = useCart();
  const toast = useToast();
  const [adicionado, setAdicionado] = useState(false);
  const [imagemQuebrou, setImagemQuebrou] = useState(false);
  const lojaProduto = produto.produto;
  const esgotado = lojaProduto
    ? statusEstoque(lojaProduto.quantidade) === "ESGOTADO"
    : false;
  const mostrarImagem = Boolean(produto.imagemUrl) && !imagemQuebrou;

  function handleAdicionar() {
    if (!lojaProduto || esgotado) return;

    adicionarItem(
      {
        produtoId: lojaProduto.id,
        nome: lojaProduto.nome,
        slug: lojaProduto.slug,
        imagemUrl: lojaProduto.imagemUrl,
        preco: lojaProduto.preco,
        estoqueConhecido: lojaProduto.quantidade,
      },
      1,
    );

    toast.success(`"${lojaProduto.nome}" adicionado ao carrinho.`);
    setAdicionado(true);
    window.setTimeout(() => setAdicionado(false), 1600);
  }

  // Barra "Adicionar à sacola" sobe por cima da foto no hover (desktop);
  // no mobile fica sempre visível. h-12 mantém o alvo de toque ≥ 44px.
  const acaoClass =
    "absolute inset-x-0 bottom-0 z-10 flex h-12 items-center justify-center gap-2 bg-brand-navy/90 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-brand-orange disabled:cursor-not-allowed disabled:bg-slate-400/90 lg:translate-y-full lg:group-hover:translate-y-0 lg:focus-visible:translate-y-0";

  const acaoConteudo = (
    <>
      {adicionado ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2} />
      ) : (
        <ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
      {esgotado ? "Esgotado" : adicionado ? "Adicionado" : "Adicionar à sacola"}
    </>
  );

  return (
    <article className="group flex h-full flex-col text-center">
      <div className="relative overflow-hidden bg-white">
        <Link href={produto.href} className="block">
          <div className="relative aspect-4/5 w-full">
            {mostrarImagem ? (
              <Image
                src={produto.imagemUrl as string}
                alt={produto.nome}
                fill
                sizes="(max-width: 639px) 85vw, (max-width: 1023px) 50vw, (max-width: 1152px) 25vw, 270px"
                className={`object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05] ${esgotado ? "opacity-60" : ""}`}
                unoptimized
                onError={() => setImagemQuebrou(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center font-serif text-sm text-brand-navy/40">
                {produto.nome}
              </div>
            )}
          </div>
        </Link>

        {produto.lancamento && (
          <span className="absolute left-0 top-4 z-10 bg-brand-navy px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-white">
            Lançamento
          </span>
        )}

        {lojaProduto ? (
          <button
            type="button"
            onClick={handleAdicionar}
            disabled={esgotado}
            className={acaoClass}
          >
            {acaoConteudo}
          </button>
        ) : (
          <Link href={produto.href} className={acaoClass}>
            {acaoConteudo}
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-col items-center">
        <Link href={produto.href}>
          <h3 className="font-serif text-[16px] font-normal leading-snug text-brand-navy transition-colors hover:text-brand-orange">
            {produto.nome}
          </h3>
        </Link>
        <span className="my-2 h-px w-6 bg-brand-orange/50" aria-hidden />
        {typeof produto.preco === "number" && (
          <p className="text-[13px] font-medium tabular-nums tracking-wide text-brand-orange">
            {formatPrice.format(produto.preco)}
          </p>
        )}
      </div>
    </article>
  );
}
