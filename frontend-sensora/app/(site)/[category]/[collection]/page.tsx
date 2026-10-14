import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CollectionShowcase from "@/components/collections/CollectionShowcase";
import KitShowcaseCard from "@/components/collections/KitShowcaseCard";
import {
  COLLECTIONS,
  KIT_4_ESTACOES_SHOWCASE,
  getCategory,
  getCategoryHref,
  getCollection,
  getCollectionHref,
} from "@/lib/content";
import JsonLd from "@/components/seo/JsonLd";
import { OPEN_GRAPH_PADRAO, breadcrumbJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return COLLECTIONS.map((collection) => ({
    category: collection.categorySlug,
    collection: collection.slug,
  }));
}

type CollectionPageProps = {
  params: Promise<{ category: string; collection: string }>;
};

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { category, collection: collectionSlug } = await params;
  const collection = getCollection(category, collectionSlug);
  if (!collection) return {};
  return {
    title: collection.name,
    description: collection.description,
    alternates: { canonical: getCollectionHref(collection) },
    openGraph: {
      ...OPEN_GRAPH_PADRAO,
      title: collection.name,
      description: collection.description,
      url: getCollectionHref(collection),
    },
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { category: categorySlug, collection: collectionSlug } = await params;
  const collection = getCollection(categorySlug, collectionSlug);

  if (!collection) {
    notFound();
  }

  const category = getCategory(collection.categorySlug);

  return (
    <div className="pt-8">
      <JsonLd
        data={breadcrumbJsonLd([
          { nome: "Início", caminho: "/" },
          ...(category ? [{ nome: category.label, caminho: getCategoryHref(category.slug) }] : []),
          { nome: collection.name, caminho: getCollectionHref(collection) },
        ])}
      />
      <CollectionShowcase collection={collection} principal />

      {/* Kit 4 Estações — mesmo card/dados de [category]/page.tsx, só
          reaproveitado aqui. Restrito a esta coleção específica (não a
          categoria inteira), então /sprays/sprays-de-ambiente e
          /difusores/difusores-de-aroma continuam sem o Kit. */}
      {collection.categorySlug === "velas" && collection.slug === "4-estacoes" && (
        <KitShowcaseCard kit={KIT_4_ESTACOES_SHOWCASE} />
      )}
    </div>
  );
}
