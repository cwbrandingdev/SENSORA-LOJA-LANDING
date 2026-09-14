"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Star } from "lucide-react";
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
  categoria?: string;
  selo?: string;
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

  const acaoClass =
    "mt-3 flex h-10 w-full items-center justify-center bg-[#6d8a4d] font-rounded text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-300 hover:bg-[#5f7a42] disabled:cursor-not-allowed disabled:bg-slate-300";

  return (
    <article className="flex h-full flex-col">
      <Link
        href={produto.href}
        className="group relative block overflow-hidden bg-[#f3eee6]"
      >
        <div className="relative aspect-square w-full min-h-[280px] sm:min-h-[320px] lg:min-h-[380px]">
          {mostrarImagem ? (
            <Image
              src={produto.imagemUrl as string}
              alt={produto.nome}
              fill
              sizes="(max-width: 639px) 85vw, (max-width: 1023px) 50vw, 25vw"
              className={`object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02] ${esgotado ? "opacity-60" : ""}`}
              onError={() => setImagemQuebrou(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
              {produto.nome}
            </div>
          )}
        </div>

        <div className="absolute left-3 top-3 z-10 flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {(produto.selo || produto.categoria) && (
            <span>{produto.selo || produto.categoria}</span>
          )}
          {produto.lancamento && (
            <span className="inline-flex items-center gap-1 text-slate-600">
              <Star className="h-3 w-3" strokeWidth={1.75} />
              Lançamento
            </span>
          )}
        </div>

        <span
          aria-hidden
          className="absolute right-3 top-3 z-10 text-slate-400"
        >
          <Heart className="h-5 w-5" strokeWidth={1.5} />
        </span>
      </Link>

      <div className="mt-3.5 flex flex-1 flex-col">
        <Link href={produto.href}>
          <h3 className="font-rounded text-[14px] font-normal leading-snug text-slate-600 transition-colors hover:text-brand-navy">
            {produto.nome}
          </h3>
        </Link>

        {typeof produto.preco === "number" && (
          <p className="mt-3 font-rounded text-[13px] tabular-nums text-slate-500">
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
