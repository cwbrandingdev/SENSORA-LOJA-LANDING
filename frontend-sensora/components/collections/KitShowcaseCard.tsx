import Button from "@/components/ui/Button";
import ImageReveal from "@/components/ui/ImageReveal";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import type { KitShowcase } from "@/lib/content";

type KitShowcaseCardProps = {
  kit: KitShowcase;
};

// "Spotlight" do Kit 4 Estações: imagem de um lado, texto do outro, dentro
// de um painel com fundo suave — não mais texto sobreposto em cima da
// imagem (isso ficava ilegível/apertado com a foto real, que é um closeup
// com pouca margem para o gradiente "respirar"). Foto real do produto
// (retrato, 4/5) fica inteira, sem cortar nada. UMA imagem só, mostrando o
// kit físico — nunca os 4 itens que o compõem (isso é papel do
// CollectionShowcase, usado pela vitrine "Velas 4 Estações" logo acima).
export default function KitShowcaseCard({ kit }: KitShowcaseCardProps) {
  const href = kit.lojaSlug ? LOJA_PRODUTO_URL(kit.lojaSlug) : null;
  const imagemRemota = kit.imageSrc.startsWith("http");

  const imagem = (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm shadow-lg shadow-brand-navy/10 transition-shadow duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:aspect-[3/4] pointer-fine:group-hover:shadow-2xl pointer-fine:group-hover:shadow-brand-navy/15">
      <ImageReveal>
        <PlaceholderImage
          src={kit.imageSrc}
          alt={kit.imageAlt}
          label={kit.name}
          unoptimized={imagemRemota}
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
          className="transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] pointer-fine:group-hover:scale-[1.03]"
        />
      </ImageReveal>
    </div>
  );

  const texto = (
    <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
        {kit.eyebrow ?? "Kit"}
      </p>
      <h2 className="mt-3 font-serif text-2xl font-normal text-brand-navy sm:text-3xl">
        {kit.name}
      </h2>
      {kit.tagline && (
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600 sm:text-base">
          {kit.tagline}
        </p>
      )}
      <div className="mt-7">
        {href ? (
          <Button href={href} variant="primary">
            Conhecer kit →
          </Button>
        ) : (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Em breve
          </p>
        )}
      </div>
    </div>
  );

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40">
      <RevealOnScroll className="group grid grid-cols-1 items-center gap-8 rounded-sm bg-[#f5f2ed] p-6 sm:grid-cols-2 sm:gap-10 sm:p-10 lg:gap-16 lg:p-14">
        {imagem}
        {texto}
      </RevealOnScroll>
    </section>
  );
}
