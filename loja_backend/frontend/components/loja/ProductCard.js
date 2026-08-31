import Link from "next/link";
import { ProductImage } from "./ProductImage";
import { ProductPrice } from "./ProductPrice";

export function ProductCard({ produto }) {
  return (
    <Link
      href={`/loja/produtos/${produto.slug}`}
      className="group block"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-sensora-bg-soft">
        <div className="relative h-full w-full transition-transform duration-700 ease-out group-hover:scale-105">
          <ProductImage src={produto.imagemUrl} alt={produto.nome} />
        </div>

        {produto.destaque ? (
          <span className="absolute left-4 top-4 font-inter text-[11px] uppercase tracking-[0.18em] text-white/90">
            Destaque
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-start justify-between gap-3 font-inter">
        <div className="min-w-0">
          {produto.categoria?.nome ? (
            <p className="truncate text-[11px] uppercase tracking-[0.14em] text-slate-500">
              {produto.categoria.nome}
            </p>
          ) : null}
          <h3 className="mt-1 truncate text-[15px] text-brand-navy transition-colors group-hover:text-brand-orange">
            {produto.nome}
          </h3>
          {produto.aroma ? (
            <p className="mt-0.5 text-[13px] text-brand-navy/70">{produto.aroma}</p>
          ) : null}
        </div>

        <ProductPrice
          value={produto.preco}
          className="shrink-0 whitespace-nowrap text-[15px] text-brand-navy"
        />
      </div>
    </Link>
  );
}
