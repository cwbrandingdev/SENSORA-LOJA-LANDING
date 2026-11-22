// Feed de produtos para o Google Merchant Center (aba Shopping do Google).
// Endereço: /feed.xml — é esse link que se cadastra no Merchant Center.
// Os dados vêm da mesma API pública da loja; se a API falhar, o feed sai
// vazio (o Google só tenta de novo na próxima busca).
import { listarProdutosPublicos, type ProdutoPublico } from "@/lib/api-publica";
import { LOJA_PRODUTO_URL } from "@/lib/config";
import { nomeCompletoDoProduto } from "@/lib/nome-produto";
import { SITE_URL } from "@/lib/seo";

// Troca os caracteres que quebrariam o XML (&, <, > e aspas).
function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Ex.: "Difusor de Ambiente Bambu" — mesmo nome do título da página do
// produto (ver lib/nome-produto.ts). Só "Bambu" fica vago no anúncio.
function tituloDoProduto(produto: ProdutoPublico): string {
  return nomeCompletoDoProduto(produto);
}

function itemDoFeed(produto: ProdutoPublico): string {
  const link = new URL(LOJA_PRODUTO_URL(produto.slug), SITE_URL).toString();
  const descricao = produto.descricao || tituloDoProduto(produto);
  const disponibilidade = produto.quantidade > 0 ? "in_stock" : "out_of_stock";
  const preco = `${produto.preco.toFixed(2)} BRL`;

  // Fotos extras da galeria (a 1ª já é a imagemUrl, por isso o slice(1)).
  const fotosExtras = (produto.imagens ?? [])
    .slice(1, 11)
    .map((url) => `<g:additional_image_link>${escaparXml(url)}</g:additional_image_link>`)
    .join("\n      ");

  return `
    <item>
      <g:id>${produto.id}</g:id>
      <g:title>${escaparXml(tituloDoProduto(produto))}</g:title>
      <g:description>${escaparXml(descricao.slice(0, 5000))}</g:description>
      <g:link>${escaparXml(link)}</g:link>
      <g:image_link>${escaparXml(produto.imagemUrl ?? "")}</g:image_link>
      ${fotosExtras}
      <g:availability>${disponibilidade}</g:availability>
      <g:price>${preco}</g:price>
      <g:brand>Sensora</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
}

export async function GET() {
  const produtos = await listarProdutosPublicos();
  // O Google recusa item sem foto, então eles ficam de fora do feed.
  const produtosComFoto = produtos.filter((produto) => produto.imagemUrl);
  const itens = produtosComFoto.map(itemDoFeed).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Sensora</title>
    <link>${SITE_URL}</link>
    <description>Velas aromáticas, sprays e difusores de ambiente da Sensora</description>${itens}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
