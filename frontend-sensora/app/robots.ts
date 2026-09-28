import type { MetadataRoute } from "next";

// /workspace-x fica fora de propósito: listá-lo aqui anunciaria o caminho
// do painel. Ele sai do índice via `robots: noindex` no próprio layout.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/conta",
        "/loja/carrinho",
        "/loja/checkout",
        "/checkout",
        "/login",
        "/register",
        "/confirmar-email",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: "https://sensorahome.com.br/sitemap.xml",
  };
}
