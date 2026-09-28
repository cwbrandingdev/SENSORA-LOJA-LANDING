import type { MetadataRoute } from "next";
import { listarProdutosPublicos } from "@/lib/api-publica";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import { CATEGORIES, COLLECTIONS, getCategoryHref } from "@/lib/content";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sensorahome.com.br";

// Só páginas públicas para visitantes. Ficam fora: carrinho/checkout,
// autenticação, /conta, /workspace-x, /icon e as variações com query de
// /loja/produtos (?categoria, ?q — cobertas pelo canonical da página).
// Sem `lastModified`: ProdutoPublico não tem data de atualização confiável.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // listarProdutosPublicos devolve [] se a API falhar — o sitemap continua
  // saindo só com as rotas estáticas.
  const produtos = await listarProdutosPublicos();

  const caminhos = [
    "/",
    "/loja",
    "/loja/produtos",
    ...CATEGORIES.map((category) => getCategoryHref(category.slug)),
    "/colecoes",
    ...COLLECTIONS.map(
      (collection) => `${getCategoryHref(collection.categorySlug)}/${collection.slug}`,
    ),
    "/quem-somos",
    "/faq",
    "/termos-de-uso",
    "/politica-de-privacidade",
    "/politica-de-cookies",
    "/trocas-e-devolucoes",
    ...produtos.map((produto) => LOJA_PRODUTO_URL(produto.slug)),
  ];

  return caminhos.map((caminho) => ({ url: new URL(caminho, SITE_URL).toString() }));
}
