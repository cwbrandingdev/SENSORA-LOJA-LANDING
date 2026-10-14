// Revisão de texto em português (botão "Revisar texto" do formulário de
// produto). Mesmo raciocínio de services/via-cep.ts: API pública de
// terceiros (LanguageTool, plano gratuito), chamada com `fetch` direto —
// nunca pela instância `api`, para não mandar o JWT a um domínio externo.
// connect-src de next.config.ts precisa incluir LANGUAGETOOL_ORIGIN.
export interface ProblemaTexto {
  /** Posição e tamanho do trecho com problema dentro do texto revisado. */
  offset: number;
  length: number;
  mensagem: string;
  /** Primeira sugestão do LanguageTool (pode não haver nenhuma). */
  sugestao: string | null;
}

interface RespostaLanguageTool {
  matches: {
    message: string;
    offset: number;
    length: number;
    replacements: { value: string }[];
  }[];
}

// Lança em falha de rede/HTTP (inclui o limite do plano gratuito, ~20
// revisões por minuto) para o componente mostrar o aviso.
export async function revisarTexto(texto: string): Promise<ProblemaTexto[]> {
  const resposta = await fetch("https://api.languagetool.org/v2/check", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ text: texto, language: "pt-BR" }),
  });
  if (!resposta.ok) {
    throw new Error(`LanguageTool respondeu ${resposta.status}`);
  }
  const dados = (await resposta.json()) as RespostaLanguageTool;
  return dados.matches.map((m) => ({
    offset: m.offset,
    length: m.length,
    mensagem: m.message,
    sugestao: m.replacements[0]?.value ?? null,
  }));
}
