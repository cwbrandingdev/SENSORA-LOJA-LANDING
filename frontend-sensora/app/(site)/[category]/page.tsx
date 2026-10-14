import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CollectionShowcase from "@/components/collections/CollectionShowcase";
import KitShowcaseCard from "@/components/collections/KitShowcaseCard";
import CategoryProducts from "@/components/sections/CategoryProducts";
import EmptyState from "@/components/ui/EmptyState";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import {
  CATEGORIES,
  KIT_4_ESTACOES_SHOWCASE,
  getCategory,
  getCategoryHref,
  getCollectionsByCategory,
} from "@/lib/content";
import JsonLd from "@/components/seo/JsonLd";
import { OPEN_GRAPH_PADRAO, breadcrumbJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category: category.slug }));
}

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const category = getCategory((await params).category);
  if (!category) return {};
  return {
    title: category.label,
    description: category.description,
    alternates: { canonical: getCategoryHref(category.slug) },
    openGraph: {
      ...OPEN_GRAPH_PADRAO,
      title: category.label,
      description: category.description,
      url: getCategoryHref(category.slug),
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const category = getCategory(categorySlug);

  if (!category) {
    notFound();
  }

  const collections = getCollectionsByCategory(category.slug);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Início", caminho: "/" },
          { nome: category.label, caminho: getCategoryHref(category.slug) },
        ])}
      />
      <section className="relative mx-auto max-w-3xl overflow-hidden px-6 py-8 text-center  lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Categoria
          </p>
          <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:mt-16 sm:text-5xl">
            {category.label}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-600">
            {category.description}
          </p>
        </RevealOnScroll>
      </section>

      {collections.length > 0 ? (
        collections.map((collection) => (
          <CollectionShowcase key={collection.slug} collection={collection} />
        ))
      ) : category.products && category.products.length > 0 ? (
        <CategoryProducts products={category.products} />
      ) : (
        <EmptyState
          title="Novidades a caminho"
          message={`Em breve, novos kits de ${category.label.toLowerCase()} por aqui.`}
        />
      )}

      {/* Kit 4 Estações — só em /velas, logo depois das 4 velas avulsas
          acima. Card único do kit físico (ver KitShowcaseCard.tsx), não uma
          Collection — por isso não vem de `collections`/`COLLECTIONS`. */}
      {category.slug === "velas" && (
        <KitShowcaseCard kit={KIT_4_ESTACOES_SHOWCASE} />
      )}
    </>
  );
}
