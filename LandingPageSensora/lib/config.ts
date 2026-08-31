// A loja agora é parte do mesmo projeto (fusão Landing + Loja) — rotas
// internas, sem depender de NEXT_PUBLIC_LOJA_URL (a env var continua
// declarada em .env.local, mas nenhum código a lê mais; remover fica para
// depois que a fusão for validada visualmente). Todo `href={LOJA_URL}`
// já existente (FeaturedProducts, ProductCard, CollectionShowcase,
// CategoryProducts) continua funcionando sem precisar tocar nesses arquivos.
export const LOJA_URL = "/loja";

// Link direto para um produto real na loja — só monta a URL a partir de um
// slug que já veio da API pública (nunca inventado).
export function LOJA_PRODUTO_URL(slug: string): string {
  return `/loja/produtos/${encodeURIComponent(slug)}`;
}
