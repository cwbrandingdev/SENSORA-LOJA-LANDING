// Mapeamento decorativo entre o slug real de uma categoria (vindo da API) e
// a fotografia de marca já existente em public/images (mesmos assets usados
// por PRODUCT_CATEGORIES em lib/content.ts — nenhuma imagem nova). Puramente
// visual: se o slug não bater com nada aqui, a categoria continua sendo
// renderizada normalmente com os dados reais, só sem a imagem temática.
const BANNER_POR_SLUG_CATEGORIA: Record<string, string> = {
  velas: "/images/categories/velas-aromaticas.jpg",
  "sprays-de-ambientes": "/images/categories/sprays-de-ambiente.png",
  "difusores-aromaticos": "/images/categories/difusores-de-aroma.jpg",
  kits: "/images/categories/kits.png",
};

export function bannerParaCategoria(slug: string): string | null {
  return BANNER_POR_SLUG_CATEGORIA[slug] ?? null;
}
