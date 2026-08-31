// Mapeamento decorativo entre o slug real de uma categoria (vindo da API) e a
// fotografia de marca correspondente em public/loja/banners. Puramente visual:
// se o slug não bater com nada aqui, a categoria continua sendo renderizada
// normalmente com os dados reais, só sem a imagem temática.
export const BANNER_POR_SLUG_CATEGORIA = {
  velas: "/loja/banners/velas.jpg",
  sprays: "/loja/banners/sprays.jpg",
  difusores: "/loja/banners/difusores.jpg",
};

export function bannerParaCategoria(slug) {
  return BANNER_POR_SLUG_CATEGORIA[slug] ?? null;
}
