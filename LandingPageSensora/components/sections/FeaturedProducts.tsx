import Button from "@/components/ui/Button";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import TextReveal from "@/components/ui/TextReveal";
import { listarProdutosPublicos } from "@/lib/api-publica";
import { LOJA_URL } from "@/lib/config";
import ProductCard from "./ProductCard";

const MAX_PRODUTOS = 4;

// Vitrine de produtos reais da Loja — única fonte de dados comerciais é a
// API pública, nunca um catálogo próprio da Landing. Curadoria, não
// listagem: mostra só os produtos com destaque=true, no máximo 4; o resto
// fica para o CTA final. Sem produtos em destaque, a seção não existe.
export default async function FeaturedProducts() {
  const produtos = await listarProdutosPublicos();
  const destaques = produtos.filter((produto) => produto.destaque).slice(0, MAX_PRODUTOS);

  if (destaques.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="destaques-heading"
      className="relative overflow-hidden bg-[#f5f2ed] px-6 py-24 sm:py-32 lg:px-10 lg:py-40"
    >
      <RevealOnScroll className="mx-auto mb-16 max-w-2xl text-center sm:mb-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Produtos em destaque
        </p>
        <h2
          id="destaques-heading"
          className="mt-4 font-serif text-3xl font-normal text-brand-navy sm:text-4xl"
        >
          <TextReveal>Descubra nossas fragrâncias</TextReveal>
        </h2>
      </RevealOnScroll>

      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-10 sm:gap-y-14">
        {destaques.map((produto, index) => (
          <ProductCard key={produto.id} produto={produto} delayMs={index * 90} />
        ))}
      </div>

      <RevealOnScroll className="mt-16 flex justify-center sm:mt-20">
        <Button href={LOJA_URL} variant="primary">
          Ver todos os produtos →
        </Button>
      </RevealOnScroll>
    </section>
  );
}
