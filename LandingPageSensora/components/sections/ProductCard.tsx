import Link from "next/link";
import ImageReveal from "@/components/ui/ImageReveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import type { ProdutoPublico } from "@/lib/api-publica";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type ProductCardProps = {
  produto: ProdutoPublico;
  delayMs?: number;
  /** Texto do rótulo de ação abaixo do preço. Default preserva o uso atual
   *  (Home/FeaturedProducts: "Ver na loja"). */
  actionLabel?: string;
};

// Mesma largura de coluna do grid de CollectionShowcase (25% menos a fatia
// do gap-x-6) — com flex + justify-center em vez de grid fixo, 1/2/3
// produtos centralizam como grupo em vez de ficar alinhados à esquerda.
export default function ProductCard({
  produto,
  delayMs = 0,
  actionLabel = "Ver na loja",
}: ProductCardProps) {
  return (
    <RevealOnScroll
      delayMs={delayMs}
      className="w-full text-center sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]"
    >
      <Link href={LOJA_PRODUTO_URL(produto.slug)} className="group block">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm bg-brand-navy">
          {produto.destaque && (
            <span className="absolute left-3 top-3 z-10 bg-background/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-orange">
              Destaque
            </span>
          )}
          <ImageReveal>
            <PlaceholderImage
              src={produto.imagemUrl}
              alt={produto.nome}
              label={produto.nome}
              unoptimized={Boolean(produto.imagemUrl)}
              sizes="(max-width: 639px) calc(100vw - 48px), (max-width: 1023px) calc(50vw - 36px), (max-width: 1231px) calc(25vw - 38px), 270px"
              className="transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
            />
          </ImageReveal>
        </div>

        <h3 className="mt-5 font-serif text-lg font-normal text-brand-navy transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-fine:group-hover:-translate-y-0.5">
          {produto.nome}
        </h3>

        <p className="mt-2 text-[17px] font-semibold tracking-tight tabular-nums text-brand-navy">
          {formatPrice.format(produto.preco)}
        </p>

        <span className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-orange">
          {actionLabel}
          <span
            aria-hidden
            className="transition-transform duration-300 pointer-fine:group-hover:translate-x-0.5"
          >
            →
          </span>
        </span>
      </Link>
    </RevealOnScroll>
  );
}
