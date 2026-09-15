import { notFound } from "next/navigation";
import CollectionShowcase from "@/components/collections/CollectionShowcase";
import KitShowcaseCard from "@/components/collections/KitShowcaseCard";
import {
  COLLECTIONS,
  KIT_4_ESTACOES_SHOWCASE,
  getCollection,
} from "@/lib/content";

export function generateStaticParams() {
  return COLLECTIONS.map((collection) => ({
    category: collection.categorySlug,
    collection: collection.slug,
  }));
}

type CollectionPageProps = {
  params: Promise<{ category: string; collection: string }>;
};

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { category: categorySlug, collection: collectionSlug } = await params;
  const collection = getCollection(categorySlug, collectionSlug);

  if (!collection) {
    notFound();
  }

  return (
    <div className="pt-28 sm:pt-36">
      <CollectionShowcase collection={collection} />

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
