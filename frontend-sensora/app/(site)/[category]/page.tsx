import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CollectionShowcase from "@/components/collections/CollectionShowcase";
import KitShowcaseCard from "@/components/collections/KitShowcaseCard";
import CategoryProducts from "@/components/sections/CategoryProducts";
import EmptyState from "@/components/ui/EmptyState";
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
      {/* Sem cabeçalho visível: a página abre direto na coleção. O H1 fica
          só para buscadores, agentes e leitores de tela. */}
      <h1 className="sr-only">{category.label}</h1>

      {collections.length > 0 ? (
        collections.map((collection) => (
          <CollectionShowcase key={collection.slug} collection={collection} semImagem />
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
