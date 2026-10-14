"use client";

// Grupo "Kits" de "Conheça os últimos lançamentos" quando ele tem um
// produto só: em vez de um card sozinho no carrossel, o kit aparece num
// selo circular — foto em círculo com o nome girando em volta — e o texto
// ao lado. Sem animação para quem prefere menos movimento.
import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { statusEstoque } from "@/lib/estoque";
import type { ReleaseItem } from "./LatestReleaseCard";
import { imagemKitRedimensionada } from "@/lib/loja-imagens";

const formatPrice = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Mesma ação do LatestReleaseCard: adiciona 1 unidade e avisa.
function BotaoSacola({ item }: { item: ReleaseItem }) {
  const { adicionarItem } = useCart();
  const toast = useToast();
  const [adicionado, setAdicionado] = useState(false);
  const produto = item.produto;
  const esgotado = produto ? statusEstoque(produto.quantidade) === "ESGOTADO" : false;

  function adicionar() {
    if (!produto || esgotado) return;
    adicionarItem(
      {
        produtoId: produto.id,
        nome: produto.nome,
        slug: produto.slug,
        imagemUrl: produto.imagemUrl,
        preco: produto.preco,
        estoqueConhecido: produto.quantidade,
      },
      1,
    );
    toast.success(`"${produto.nome}" adicionado ao carrinho.`);
    setAdicionado(true);
    window.setTimeout(() => setAdicionado(false), 1600);
  }

  const classe =
    "inline-flex h-12 items-center justify-center gap-2 bg-brand-navy px-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-brand-orange disabled:cursor-not-allowed disabled:bg-slate-400";
  const conteudo = (
    <>
      {adicionado ? <Check className="h-4 w-4" strokeWidth={2} /> : <ShoppingBag className="h-4 w-4" strokeWidth={1.75} />}
      {esgotado ? "Esgotado" : adicionado ? "Adicionado" : "Adicionar à sacola"}
    </>
  );
  return produto ? (
    <button type="button" onClick={adicionar} disabled={esgotado} className={classe}>
      {conteudo}
    </button>
  ) : (
    <Link href={item.href} className={classe}>
      {conteudo}
    </Link>
  );
}

export default function KitSeloCircular({ item }: { item: ReleaseItem }) {
  const idCirculo = useId();
  const [imagemQuebrou, setImagemQuebrou] = useState(false);
  const textoSelo = `Kit exclusivo · ${item.nome} · Sensora · `.toUpperCase();
  const descricao = item.produto?.descricao?.trim();

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
      <div className="relative mx-auto aspect-square w-full max-w-md">
        <svg
          viewBox="0 0 400 400"
          aria-hidden
          className="absolute inset-0 h-full w-full motion-safe:animate-[spin_40s_linear_infinite]"
        >
          <defs>
            <path id={idCirculo} d="M200,200 m-182,0 a182,182 0 1,1 364,0 a182,182 0 1,1 -364,0" />
          </defs>
          <text className="fill-brand-orange text-[15px] font-semibold tracking-[0.32em]">
            <textPath href={`#${idCirculo}`}>{textoSelo.repeat(2)}</textPath>
          </text>
        </svg>
        <Link href={item.href} className="group absolute inset-[13%] block overflow-hidden rounded-full bg-white">
          {item.imagemUrl && !imagemQuebrou ? (
            <Image
              src={imagemKitRedimensionada(item.imagemUrl, 700)}
              alt={item.nome}
              fill
              sizes="(max-width: 767px) 70vw, 340px"
              unoptimized
              onError={() => setImagemQuebrou(true)}
              className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full items-center justify-center font-serif text-brand-navy/40">{item.nome}</span>
          )}
        </Link>
      </div>

      <div className="flex flex-col items-start gap-4">
        <h4 className="font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">{item.nome}</h4>
        {descricao && (
          <p className="line-clamp-4 max-w-md whitespace-pre-line text-[15px] leading-relaxed text-slate-600">
            {descricao}
          </p>
        )}
        {typeof item.preco === "number" && (
          <p className="text-2xl font-medium tabular-nums tracking-wide text-brand-orange">
            {formatPrice.format(item.preco)}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-6">
          <BotaoSacola item={item} />
          <Link
            href={item.href}
            className="group/link inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-navy transition-colors hover:text-brand-orange"
          >
            Ver detalhes
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/link:translate-x-0.5" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </div>
  );
}
