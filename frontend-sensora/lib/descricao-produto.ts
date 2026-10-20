// A descrição cadastrada no Admin termina com uma ficha técnica em linhas
// rotuladas ("Volume: 250 ml", "Peso líquido: 200 g", "Tempo de queima: …",
// "Rendimento: … borrifadas", "Sistema de difusão: …", "Modo de uso: …").
// A vitrine não exibe essa ficha — só a história da fragrância e as notas.
// As linhas são removidas na exibição (o cadastro no Admin não muda);
// frases comuns com essas palavras ("Uma borrifada de… renova…") ficam,
// porque só sai o que está em formato "Rótulo: valor".

const ROTULO_FICHA =
  "(?:volume|peso(?:\\s+l[ií]quido|\\s+por\\s+vela)?|tempo\\s+de\\s+queima|rendimento|sistema\\s+de\\s+difus[ãa]o|modo\\s+de\\s+uso)";

const LINHA_FICHA = new RegExp(`^\\s*${ROTULO_FICHA}\\s*:`, "i");
const TRECHO_FICHA = new RegExp(`${ROTULO_FICHA}\\s*:[^.\\n]*(?:\\.|$)`, "gi");

export function descricaoSemFichaTecnica(descricao: string): string {
  return descricao
    .split("\n")
    .filter((linha) => !LINHA_FICHA.test(linha))
    .map((linha) => linha.replace(TRECHO_FICHA, "").replace(/\s{2,}/g, " ").trim())
    .filter((linha, indice, linhas) => linha !== "" || (indice > 0 && linhas[indice - 1] !== ""))
    .join("\n")
    .trim();
}

// As mesmas linhas que descricaoSemFichaTecnica tira, como pares para a
// "Ficha técnica" da página do produto ("Peso líquido: 200 g." ->
// { rotulo: "Peso líquido", valor: "200 g" }).
export function fichaTecnica(descricao: string): { rotulo: string; valor: string }[] {
  return [...descricao.matchAll(TRECHO_FICHA)]
    .map(([trecho]) => {
      const [rotulo, ...resto] = trecho.split(":");
      return { rotulo: rotulo.trim(), valor: resto.join(":").trim().replace(/\.$/, "") };
    })
    .filter((item) => item.valor !== "")
    .map((item) => ({ ...item, rotulo: item.rotulo.charAt(0).toUpperCase() + item.rotulo.slice(1) }));
}
