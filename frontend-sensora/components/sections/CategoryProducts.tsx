import Button from "@/components/ui/Button";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { LOJA_URL } from "@/lib/config";
import type { CategoryProduct } from "@/lib/content";

type CategoryProductsProps = {
  products: CategoryProduct[];
};

// Grid institucional para categorias sem uma Collection temática própria
// (Sprays, Difusores): mesma linguagem visual do grid de itens de
// CollectionShowcase, sem título/hero/descrição — o cabeçalho da própria
// página de categoria já cobre isso.
export default function CategoryProducts({ products }: CategoryProductsProps) {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40">
      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-10 sm:mt-20 sm:grid-cols-3 sm:gap-6">
        {products.map((product, index) => (
          <RevealOnScroll key={product.slug} delayMs={index * 90} className="text-center">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm">
              <PlaceholderImage src={product.imageSrc} alt={product.imageAlt} label={product.name} />
            </div>
            <h3 className="mt-4 font-serif text-xl font-normal text-brand-navy">{product.name}</h3>
          </RevealOnScroll>
        ))}
      </div>

      <RevealOnScroll className="mt-16 flex justify-center sm:mt-20">
        <Button href={LOJA_URL} variant="primary">
          Conhecer produtos →
        </Button>
      </RevealOnScroll>
    </section>
  );
}
