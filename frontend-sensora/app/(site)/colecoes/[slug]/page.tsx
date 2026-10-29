import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CollectionShowcase from "@/components/collections/CollectionShowcase";
import EmptyState from "@/components/ui/EmptyState";
import { buscarColecaoPublica } from "@/lib/api-publica";
import { produtoParaCartao } from "@/lib/colecao-com-loja";

// Coleção de data festiva ligada no Admin (/workspace-x/colecoes), com a
// mesma vitrine das páginas de categoria (/velas, /sprays...). Desligada
// ou inexistente, a API responde 404 e a página também.
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const colecao = await buscarColecaoPublica(slug);
  if (!colecao) return {};

  return {
    title: colecao.titulo || colecao.nome,
    description: colecao.descricao || `Coleção ${colecao.nome} da Sensora.`,
    alternates: { canonical: `/colecoes/${colecao.slug}` },
  };
}

export default async function ColecaoPage({ params }: Props) {
  const { slug } = await params;
  const colecao = await buscarColecaoPublica(slug);
  if (!colecao) notFound();

  return (
    <CollectionShowcase
      principal
      collection={{
        slug: colecao.slug,
        // Título vazio no Admin = usa o nome do menu.
        name: colecao.titulo || colecao.nome,
        description: colecao.descricao ?? "",
        items: colecao.produtos.map(produtoParaCartao),
      }}
      semItens={<EmptyState compact title="Novidades a caminho" message="" />}
    />
  );
}
