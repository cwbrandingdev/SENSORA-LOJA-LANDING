// Página de uma coleção festiva (/colecoes/<slug>): no topo, o texto e as
// fotos dos produtos empilhadas como presentes; embaixo, cada produto com
// uma etiqueta de presente pendurada (nome e preço).
import Link from "next/link";
import type {
  ColecaoPublicaComProdutos,
  ProdutoPublico,
} from "@/lib/api-publica";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import {
  imagemKitRedimensionada,
  segundaImagemDaGaleria,
} from "@/lib/loja-imagens";
import HoverSecondImage from "@/components/ui/HoverSecondImage";

const preco = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function FotoProduto({
  produto,
  largura,
  className,
}: {
  produto: ProdutoPublico;
  largura: number;
  className: string;
}) {
  if (!produto.imagemUrl) return null;
  return (
    <img
      src={imagemKitRedimensionada(produto.imagemUrl, largura)}
      alt={produto.nome}
      className={className}
    />
  );
}

type Props = { colecao: ColecaoPublicaComProdutos };

// Topo: texto à esquerda e as fotos dos produtos sobrepostas à direita.
function TopoPresentes({ colecao }: Props) {
  const titulo = colecao.titulo || colecao.nome;
  const destaques = colecao.produtos.filter((p) => p.imagemUrl).slice(0, 3);
  const inclinacoes = ["-rotate-6", "rotate-3", "-rotate-2"];
  const posicoes = ["left-0 top-6", "right-0 top-0", "left-1/4 bottom-0"];

  return (
    <section className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-16 lg:grid-cols-2 lg:px-10 lg:py-24">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Coleção especial
        </p>
        <h1 className="mt-4 font-serif text-5xl font-normal tracking-tight text-brand-navy sm:text-6xl">
          {titulo}
        </h1>
        {colecao.descricao && (
          <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">
            {colecao.descricao}
          </p>
        )}
        <a
          href="#presentes"
          className="mt-10 inline-flex bg-brand-navy px-8 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-brand-orange"
        >
          Ver presentes
        </a>
      </div>
      <div className="relative mx-auto h-[28rem] w-full max-w-md sm:h-[34rem]">
        {destaques.map((produto, indice) => (
          <div
            key={produto.id}
            className={`absolute w-1/2 bg-white p-2 pb-8 shadow-xl ${inclinacoes[indice]} ${posicoes[indice]}`}
          >
            <FotoProduto
              produto={produto}
              largura={500}
              className="aspect-[3/4] w-full object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// Produtos: foto quadrada e, pendurada nela, uma etiqueta de presente (com
// furo e barbante) com o nome e o preço.
function ProdutosComEtiqueta({ colecao }: Props) {
  return (
    <div className="mx-auto grid max-w-6xl gap-x-8 gap-y-20 px-6 sm:grid-cols-2 lg:grid-cols-3 lg:px-10">
      {colecao.produtos.map((produto, indice) => (
        <Link
          key={produto.id}
          href={LOJA_PRODUTO_URL(produto.slug)}
          className="group relative block"
        >
          <div className="relative aspect-square overflow-hidden rounded-sm shadow-md">
            <FotoProduto
              produto={produto}
              largura={700}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />

            <HoverSecondImage
              src={imagemKitRedimensionada(
                segundaImagemDaGaleria(produto.imagens, produto.imagemUrl),
                700,
              )}
              label={produto.nome}
              unoptimized
              sizes="(max-widht: 639px) 100vw, (max-widht: 1023px) 50vw, 380px"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>
          {/* Barbante + etiqueta, alternando a inclinação. */}
          <span
            aria-hidden
            className="absolute -bottom-6 left-10 h-10 w-px bg-[#a8322d]"
          />
          <div
            className={`absolute -bottom-14 left-4 w-44 bg-[#f4ece2] px-4 pb-3 pt-5 shadow-md transition-transform group-hover:rotate-0 [clip-path:polygon(12%_0,88%_0,100%_18%,100%_100%,0_100%,0_18%)] ${indice % 2 === 0 ? "-rotate-3" : "rotate-2"}`}
          >
            <span
              aria-hidden
              className="absolute left-1/2 top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-[#faf8f4]"
            />
            <p className="font-serif text-lg leading-tight text-brand-navy">
              {produto.nome}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#a8322d]">
              {preco.format(produto.preco)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function ColecaoFestiva({ colecao }: Props) {
  return (
    <>
      <TopoPresentes colecao={colecao} />
      <section id="presentes" className="scroll-mt-32 pb-28">
        <ProdutosComEtiqueta colecao={colecao} />
      </section>
    </>
  );
}
