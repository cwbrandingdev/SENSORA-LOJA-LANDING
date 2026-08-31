import { notFound } from "next/navigation";
import CollectionShowcase from "@/components/collections/CollectionShowcase";
import { COLLECTIONS, getCollection } from "@/lib/content";

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
    </div>
  );
}
