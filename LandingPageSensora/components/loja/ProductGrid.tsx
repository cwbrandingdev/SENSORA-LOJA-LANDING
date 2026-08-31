// Novo: grid de catálogo interno da Loja. Reaproveita o ProductCard já
// existente em components/sections/ProductCard.tsx (o mesmo usado por
// FeaturedProducts) em vez de recriar um card — só muda o contexto onde é
// listado. EmptyState também é o já existente em components/ui.
import EmptyState from "@/components/ui/EmptyState";
import ProductCard from "@/components/sections/ProductCard";
import type { ProdutoPublico } from "@/lib/api-publica";

type ProductGridProps = {
  produtos: ProdutoPublico[];
  /** Repassado a cada ProductCard. Default do próprio ProductCard
   *  ("Ver na loja") se omitido. */
  actionLabel?: string;
};

export default function ProductGrid({ produtos, actionLabel }: ProductGridProps) {
  if (produtos.length === 0) {
    return (
      <EmptyState
        eyebrow="Nenhum resultado"
        title="Nenhum produto encontrado"
        message="Ainda não há produtos cadastrados nesta categoria."
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-10 sm:gap-y-14">
      {produtos.map((produto, index) => (
        <ProductCard
          key={produto.id}
          produto={produto}
          delayMs={(index % 8) * 90}
          actionLabel={actionLabel}
        />
      ))}
    </div>
  );
}
