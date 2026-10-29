import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductGrid from "@/components/loja/ProductGrid";
import EmptyState from "@/components/ui/EmptyState";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { buscarColecaoPublica } from "@/lib/api-publica";

// Coleção de data festiva ligada no Admin (/workspace-x/colecoes). Desligada
// ou inexistente, a API responde 404 e a página também.
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const colecao = await buscarColecaoPublica(slug);
  if (!colecao) return {};

  return {
    title: colecao.nome,
    description: colecao.descricao || `Coleção ${colecao.nome} da Sensora.`,
    alternates: { canonical: `/colecoes/${colecao.slug}` },
  };
}

export default async function ColecaoPage({ params }: Props) {
  const { slug } = await params;
  const colecao = await buscarColecaoPublica(slug);
  if (!colecao) notFound();

  return (
    <>
      {colecao.imagemUrl && (
        <div className="relative mx-auto aspect-[16/7] max-h-[420px] w-full max-w-7xl overflow-hidden lg:rounded-sm">
          <PlaceholderImage
            src={colecao.imagemUrl}
            alt={colecao.nome}
            sizes="(min-width: 1280px) 1280px, 100vw"
            priority
          />
        </div>
      )}

      <section className="mx-auto max-w-3xl px-6 py-12 text-center lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">Coleção especial</p>
          <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
            {colecao.nome}
          </h1>
          {colecao.descricao && (
            <p className="mt-6 text-base leading-relaxed text-slate-600">{colecao.descricao}</p>
          )}
        </RevealOnScroll>
      </section>

      <div className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-10">
        {colecao.produtos.length === 0 ? (
          <EmptyState title="Novidades a caminho" message="Em breve, produtos desta coleção por aqui." />
        ) : (
          <ProductGrid produtos={colecao.produtos} actionLabel="Ver detalhes" />
        )}
      </div>
    </>
  );
}
