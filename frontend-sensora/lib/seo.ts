// Dados compartilhados de SEO: Open Graph base e JSON-LD (schema.org).
// Nada aqui aparece na tela — só no <head> e em <script type="application/ld+json">.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sensorahome.com.br";

// O `openGraph` de uma página substitui o do layout inteiro (não mescla),
// então as páginas que definem o próprio espalham este objeto. A imagem é
// leve (~90 KB) de propósito: as fotos de /images têm de 2 a 20 MB e o
// WhatsApp não mostra prévia de imagem pesada.
export const OPEN_GRAPH_PADRAO = {
  siteName: "Sensora",
  locale: "pt_BR",
  type: "website",
  images: [
    {
      url: "/og-image.jpg",
      width: 1200,
      height: 630,
      alt: "Velas aromáticas Coleção 4 Estações da Sensora",
    },
  ],
};

export function urlAbsoluta(caminho: string): string {
  return new URL(caminho, SITE_URL).toString();
}

// Descrição curta para <meta description> a partir de um texto longo.
export function resumir(texto: string, limite = 160): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;
  return `${limpo.slice(0, limite - 1).replace(/\s+\S*$/, "")}…`;
}

export function breadcrumbJsonLd(itens: { nome: string; caminho: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: itens.map((item, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      name: item.nome,
      item: urlAbsoluta(item.caminho),
    })),
  };
}
