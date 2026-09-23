"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
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

  // h-11 (44px, achado REFINAMENTO da auditoria mobile) — alvo de toque
  // mínimo recomendado, mesmo padrão já usado no stepper/remover do
  // carrinho (QuantityStepper, CartItemRow).
  const acaoClass =
    "mt-3 flex h-11 w-full items-center justify-center bg-brand-orange text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-300 hover:bg-brand-orange-light disabled:cursor-not-allowed disabled:bg-slate-300";

  return (
    <article className="flex h-full flex-col">
      <Link
        href={produto.href}
        className="group relative block overflow-hidden bg-white"
      >
        <div className="relative aspect-square w-full">
          {mostrarImagem ? (
            <Image
              src={produto.imagemUrl as string}
              alt={produto.nome}
              fill
              sizes="(max-width: 639px) 85vw, (max-width: 1023px) 50vw, (max-width: 1152px) 25vw, 270px"
              className={`object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02] ${esgotado ? "opacity-60" : ""}`}
              unoptimized
              onError={() => setImagemQuebrou(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center font-serif text-sm text-brand-navy/40">
              {produto.nome}
            </div>
          )}
        </div>

        {produto.lancamento && (
          <div className="absolute left-3 top-3 z-10 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3" strokeWidth={1.75} />
              Lançamento
            </span>
          </div>
        )}
      </Link>

      <div className="mt-3.5 flex flex-1 flex-col">
        <Link href={produto.href}>
          <h3 className="font-serif text-[14px] font-normal leading-snug text-brand-navy transition-colors hover:text-brand-orange">
            {produto.nome}
          </h3>
        </Link>

        {typeof produto.preco === "number" && (
          <p className="mt-3 text-[13px] font-semibold tabular-nums text-brand-navy">
            {formatPrice.format(produto.preco)}
          </p>
        )}

        {lojaProduto ? (
          <button
            type="button"
            onClick={handleAdicionar}
            disabled={esgotado}
            className={acaoClass}
          >
            {esgotado ? "Esgotado" : adicionado ? "Adicionado" : "Adicionar"}
          </button>
        ) : (
          <Link href={produto.href} className={acaoClass}>
            Adicionar
          </Link>
        )}
      </div>
    </article>
  );
}
