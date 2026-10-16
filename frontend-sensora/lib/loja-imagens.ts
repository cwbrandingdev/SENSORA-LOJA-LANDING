// Mapeamento decorativo entre o slug real de uma categoria (vindo da API) e
// a fotografia de marca já existente em public/images (mesmos assets usados
// por PRODUCT_CATEGORIES em lib/content.ts — nenhuma imagem nova). Puramente
// visual: se o slug não bater com nada aqui, a categoria continua sendo
// renderizada normalmente com os dados reais, só sem a imagem temática.
const BANNER_POR_SLUG_CATEGORIA: Record<string, string> = {
  "velas-aromaticas": "/images/categories/velas-aromaticas.jpg",
  "sprays-de-ambientes": "/images/categories/sprays-de-ambiente.png",
  "difusores-de-aroma": "/images/categories/difusores-de-aroma.jpg",
  kits: "/images/categories/kits.png",
};

export function bannerParaCategoria(slug: string): string | null {
  return BANNER_POR_SLUG_CATEGORIA[slug] ?? null;
}

/** Segunda foto da galeria (a primeira depois da capa) — é a imagem que os
 *  cartões de produto mostram no hover. `undefined` quando o produto só
 *  tem a capa cadastrada. */
export function segundaImagemDaGaleria(
  imagens: string[] | undefined,
  capa: string | undefined,
): string | undefined {
  return imagens?.find((url) => url && url !== capa);
}

// Fotos de produto vêm do ImageKit no tamanho original (~150–180 KB cada) e
// são exibidas com `unoptimized`. O ImageKit redimensiona pela própria URL
// (`?tr=w-<largura>`, já entregando WebP): passe o dobro da largura exibida
// para telas de alta densidade. Qualquer outra URL (ex.: fotos locais em
// /images) volta sem mudança.
export function imagemKitRedimensionada<T extends string | undefined>(url: T, largura: number): T {
  if (!url) return url;
  try {
    const endereco = new URL(url);
    if (endereco.hostname !== "ik.imagekit.io" || endereco.searchParams.has("tr")) return url;
    endereco.searchParams.set("tr", `w-${largura}`);
    return endereco.toString() as T;
  } catch {
    return url;
  }
}
