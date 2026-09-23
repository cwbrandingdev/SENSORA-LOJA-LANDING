import type { ProdutoPublico } from "@/lib/api-publica";

export function normalizarBusca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function textoDoProduto(produto: ProdutoPublico) {
  return [produto.nome, produto.aroma, produto.descricao, produto.categoria?.nome]
    .filter((campo): campo is string => Boolean(campo))
    .join(" ");
}

function tokens(valor: string) {
  return normalizarBusca(valor).split(/\s+/).filter((parte) => parte.length > 0);
}

function distancia(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const linha = Array.from({ length: b.length + 1 }, (_, indice) => indice);
  for (let i = 1; i <= a.length; i++) {
    let anterior = i - 1;
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const atual = linha[j];
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + custo);
      anterior = atual;
    }
  }
  return linha[b.length];
}

function similaridade(consulta: string, palavra: string) {
  if (!consulta || !palavra) return 0;
  if (palavra.includes(consulta) || consulta.includes(palavra)) {
    const menor = Math.min(consulta.length, palavra.length);
    if (menor >= 3) return 0.94;
  }
  const maior = Math.max(consulta.length, palavra.length);
  return 1 - distancia(consulta, palavra) / maior;
}

function pontuar(termo: string, produto: ProdutoPublico) {
  const partes = tokens(termo);
  const palavras = tokens(textoDoProduto(produto)).filter((palavra) => palavra.length > 1);
  if (!partes.length || !palavras.length) return 0;
  const notas = partes.map((parte) =>
    Math.max(...palavras.map((palavra) => similaridade(parte, palavra))),
  );
  return notas.reduce((soma, nota) => soma + nota, 0) / notas.length;
}

export function produtoCombina(produto: ProdutoPublico, termo: string) {
  const partes = tokens(termo);
  if (!partes.length) return false;
  const texto = normalizarBusca(textoDoProduto(produto));
  return partes.every((parte) => texto.includes(parte));
}

export function filtrarProdutos(produtos: ProdutoPublico[], termo: string) {
  return produtos.filter((produto) => produtoCombina(produto, termo));
}

export function sugerirProdutos(produtos: ProdutoPublico[], termo: string, limite = 3) {
  return produtos
    .map((produto) => ({ produto, nota: pontuar(termo, produto) }))
    .filter((item) => item.nota >= 0.62)
    .sort((a, b) => b.nota - a.nota)
    .slice(0, limite)
    .map((item) => item.produto);
}
