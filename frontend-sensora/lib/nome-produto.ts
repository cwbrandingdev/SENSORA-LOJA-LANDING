// Nome completo do produto para título, H1 e buscadores. O nome cadastrado
// costuma ser só o aroma ("Bambu"), e existem vela, spray e difusor com o
// mesmo aroma: sem o tipo, os três teriam o mesmo título no Google.
// "Bambu" na categoria Velas Aromáticas → "Vela Aromática Bambu".

// Tipo no singular, pelo slug da categoria. Mesma lista do backend
// (produtos.service.ts, endereço de produto novo): categoria nova entra nos dois.
const TIPO_POR_CATEGORIA: Record<string, string> = {
  "velas-aromaticas": "Vela Aromática",
  "sprays-de-ambientes": "Spray de Ambiente",
  "difusores-de-aroma": "Difusor de Ambiente",
  kits: "Kit",
};

type ProdutoComCategoria = {
  nome: string;
  categoria?: { slug: string } | null;
};

export function nomeCompletoDoProduto(produto: ProdutoComCategoria): string {
  const tipo = produto.categoria ? TIPO_POR_CATEGORIA[produto.categoria.slug] : undefined;
  if (!tipo) return produto.nome;

  // Nome que já começa com o tipo ("Vela Noite Feliz") não repete a palavra.
  const primeiraPalavra = tipo.split(" ")[0].toLowerCase();
  if (produto.nome.toLowerCase().startsWith(primeiraPalavra)) return produto.nome;

  return `${tipo} ${produto.nome}`;
}
