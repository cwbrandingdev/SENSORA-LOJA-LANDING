import { Reveal } from "@/components/site/Reveal";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ produtos }) {
  if (produtos.length === 0) {
    return (
      <p className="py-24 text-center font-inter text-sm text-slate-500">
        Nenhum produto encontrado nesta categoria.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
      {produtos.map((produto, index) => (
        <Reveal key={produto.id} index={index % 8}>
          <ProductCard produto={produto} />
        </Reveal>
      ))}
    </div>
  );
}
