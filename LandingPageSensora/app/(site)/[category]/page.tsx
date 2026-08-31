import { notFound } from "next/navigation";
import CollectionShowcase from "@/components/collections/CollectionShowcase";
import CategoryProducts from "@/components/sections/CategoryProducts";
import EmptyState from "@/components/ui/EmptyState";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import { CATEGORIES, getCategory, getCollectionsByCategory } from "@/lib/content";

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category: category.slug }));
}

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const category = getCategory(categorySlug);

  if (!category) {
    notFound();
  }

  const collections = getCollectionsByCategory(category.slug);

  return (
    <>
      <section className="relative mx-auto max-w-3xl overflow-hidden px-6 pt-28 pb-8 text-center sm:pt-36 lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">Categoria</p>
          <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
            {category.label}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-600">{category.description}</p>
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
    </>
  );
}
