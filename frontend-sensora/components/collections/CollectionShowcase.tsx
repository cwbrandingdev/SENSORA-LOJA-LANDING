import Link from "next/link";
import Button from "@/components/ui/Button";
import ImageReveal from "@/components/ui/ImageReveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import TextReveal from "@/components/ui/TextReveal";
import { LOJA_URL, LOJA_PRODUTO_URL } from "@/lib/config";
import type { Collection } from "@/lib/content";

type CollectionShowcaseProps = {
  collection: Collection;
  /** Na página própria da coleção o título é o H1 (e os itens, H2). */
  principal?: boolean;
};

// Vitrine editorial de uma coleção: apresenta, não vende — o único caminho
// de conversão continua sendo o CTA final para a loja. Exceção pontual: um
// item cujo `lojaSlug` já foi conferido contra o catálogo real (ver
// lib/content.ts) vira um link direto para aquele produto — os demais
// (sem `lojaSlug`) continuam exatamente como antes, sem link nenhum.
export default function CollectionShowcase({
  collection,
  principal = false,
}: CollectionShowcaseProps) {
  const headingId = `${collection.slug}-heading`;
  const Titulo = principal ? "h1" : "h2";
  const TituloItem = principal ? "h2" : "h3";

  return (
    <section
      aria-labelledby={headingId}
      className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40"
    >
      <RevealOnScroll className="mx-auto mt-12 max-w-3xl text-center sm:mt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          {collection.eyebrow ?? "Produtos"}
        </p>
        <Titulo
          id={headingId}
          className="mt-4 font-serif text-3xl font-normal tracking-tight text-brand-navy sm:teFdesxt-4xl"
        >
          <TextReveal>{collection.name}</TextReveal>
        </Titulo>
        {collection.tagline && (
          <p className="mt-3 text-sm font-light text-slate-500 sm:text-base">
            {collection.tagline}
          </p>
        )}
        <p className="mt-6 text-base leading-relaxed text-slate-600">
          {collection.description}
        </p>
      </RevealOnScroll>

      {/* Flex + justify-center em vez de grid: com uma Collection de menos de
          4 itens (Sprays, Difusores), os cards centralizam como grupo na
          linha em vez de ficar alinhados à esquerda com uma coluna vazia à
          direita. As larguras replicam exatamente as colunas do grid antigo
          (25% menos a fatia do gap-x-6), então 4 itens (Velas) preenchem a
          linha de ponta a ponta como antes — sem mudança visual pra eles. */}
      <div className="mx-auto mt-16 flex max-w-6xl flex-wrap justify-center gap-x-6 gap-y-10 sm:mt-20 sm:gap-y-14">
        {collection.items.map((item, index) => {
          // Só monta a URL a partir de um lojaSlug já conferido (nunca a
          // partir do slug editorial do item, que não existe no catálogo
          // real) — ver LOJA_PRODUTO_URL em lib/config.ts.
          const hrefProdutoReal = item.lojaSlug
            ? LOJA_PRODUTO_URL(item.lojaSlug)
            : null;

          const conteudo = (
            <>
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm shadow-md shadow-brand-navy/10 transition-shadow duration-700 group-hover:shadow-lg group-hover:shadow-brand-navy/15">
                <ImageReveal>
                  <PlaceholderImage
                    src={item.imageSrc}
                    alt={item.imageAlt}
                    label={item.name}
                    // Foto de produto do Admin já vem redimensionada pelo
                    // ImageKit (ver colecaoComProdutosDaLoja).
                    unoptimized={item.imageSrc?.startsWith(
                      "https://ik.imagekit.io",
                    )}
                    // Grid de 1/2/4 colunas dentro de um container max-w-6xl (1152px)
                    // com gap-x-6; acima de 1231px de viewport o grid já está no teto.
                    sizes="(max-width: 639px) calc(100vw - 48px), (max-width: 1023px) calc(50vw - 36px), (max-width: 1231px) calc(25vw - 38px), 270px"
                    className="transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]"
                  />
                </ImageReveal>
              </div>

              <TituloItem className="mt-3 font-serif text-xl font-normal text-brand-navy transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5">
                {item.name}
              </TituloItem>
              {item.mood && (
                <p className="mx-auto mt-2 max-w-[26ch] text-sm leading-relaxed text-slate-600">
                  {item.mood}
                </p>
              )}
            </>
          );

          return (
            <RevealOnScroll
              key={item.slug}
              delayMs={index * 90}
              className="group w-full text-center sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]"
            >
              {hrefProdutoReal ? (
                <Link href={hrefProdutoReal} className="block">
                  {conteudo}
                </Link>
              ) : (
                conteudo
              )}
            </RevealOnScroll>
          );
        })}
      </div>
    </section>
  );
}
