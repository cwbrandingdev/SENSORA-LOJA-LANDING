import Link from "next/link";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import TextReveal from "@/components/ui/TextReveal";
import { PRODUCT_CATEGORIES } from "@/lib/content";

// Hierarquia editorial do grid: o primeiro item (com foto real) ganha
// destaque em 2x2; os demais se distribuem em torno dele, sem sobrar
// espaço vazio na malha de 4 colunas x 2 linhas do desktop.
const CATEGORY_LAYOUT: Record<number, { wrapper: string; title: string; sizes: string }> = {
  0: {
    wrapper: "lg:col-span-2 lg:row-span-2 lg:aspect-auto lg:h-full",
    title: "text-2xl sm:text-3xl",
    // Célula dupla (2 colunas + 1 gap) a partir do lg; grid-cols-2 abaixo disso.
    sizes: "(max-width: 639px) calc(100vw - 48px), (max-width: 1023px) calc(50vw - 36px), (max-width: 1280px) calc(50vw - 52px), 588px",
  },
  1: {
    wrapper: "lg:col-span-2 lg:aspect-[16/9]",
    title: "text-xl",
    sizes: "(max-width: 639px) calc(100vw - 48px), (max-width: 1023px) calc(50vw - 36px), (max-width: 1280px) calc(50vw - 52px), 588px",
  },
};

// Célula simples (1 de 4 colunas no desktop) — usada pelos itens sem
// entrada em CATEGORY_LAYOUT (índices 2 em diante).
const DEFAULT_CATEGORY_SIZES =
  "(max-width: 639px) calc(100vw - 48px), (max-width: 1023px) calc(50vw - 36px), (max-width: 1280px) calc(25vw - 38px), 282px";

export default function ProductCategories() {
  return (
    <div className="bg-[#f5f2ed]">
      <section
        aria-labelledby="produtos-heading"
        className="bg-[#f5f2ed] relative mx-auto max-w-7xl overflow-hidden px-6 py-24 sm:py-32 lg:px-10 lg:py-40"
      >
        <RevealOnScroll className="mx-auto mb-16 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Nossos produtos
          </p>
          <h2
            id="produtos-heading"
            className="mt-4 font-serif text-3xl font-normal text-brand-navy sm:text-4xl"
          >
            <TextReveal>Uma experiência sensorial para cada ambiente</TextReveal>
          </h2>
        </RevealOnScroll>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCT_CATEGORIES.map((category, index) => {
            const layout = CATEGORY_LAYOUT[index];
            return (
              <RevealOnScroll
                key={category.id}
                delayMs={index * 90}
                className={`aspect-[3/4] overflow-hidden rounded-sm ${layout?.wrapper ?? ""}`}
              >
                <Link
                  href={category.href}
                  className="group relative block h-full w-full transition-shadow duration-700 hover:shadow-lg hover:shadow-brand-navy/15"
                >
                  <PlaceholderImage
                    src={category.imageSrc}
                    alt={category.label}
                    label={category.label}
                    sizes={layout?.sizes ?? DEFAULT_CATEGORY_SIZES}
                    className="transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent transition-opacity duration-700 group-hover:from-black/70"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-5 lg:p-7">
                    <h3
                      className={`font-serif font-normal text-white transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-fine:group-hover:-translate-y-0.5 ${layout?.title ?? "text-xl"}`}
                    >
                      {category.label}
                    </h3>
                    {/* Em telas sem hover confiável (touch), a ação já nasce visível —
                        só em pointer fino (mouse) ela começa discreta e revela no hover
                        (ou no foco por teclado). Ver contexto na entrega desta etapa. */}
                    <span className="mt-1 flex translate-y-0 items-center gap-1.5 text-xs uppercase tracking-widest text-brand-orange-light opacity-100 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-fine:translate-y-1 pointer-fine:opacity-0 pointer-fine:group-hover:translate-y-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-visible:translate-y-0 pointer-fine:group-focus-visible:opacity-100">
                      Ver produtos →
                    </span>
                  </div>
                </Link>
              </RevealOnScroll>
            );
          })}
        </div>
      </section>
    </div>
  );
}
