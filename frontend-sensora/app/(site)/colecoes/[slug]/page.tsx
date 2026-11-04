import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ColecaoFestiva from "@/components/collections/ColecaoFestiva";
import { buscarColecaoPublica } from "@/lib/api-publica";

// Coleção de data festiva ligada no Admin (/workspace-x/colecoes). Desligada
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

  return <ColecaoFestiva colecao={colecao} />;
}
