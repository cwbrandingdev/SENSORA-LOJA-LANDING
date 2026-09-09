// Preenchimento automático de endereço a partir do CEP (EnderecoForm) — ao
// contrário dos demais arquivos em services/, este NÃO usa a instância
// `api` (services/api.ts): ViaCEP é uma API pública de terceiros, sem
// Authorization/baseURL do backend da Sensora, então um `fetch` direto
// evita anexar o JWT do usuário a um domínio externo e não precisa de
// nenhuma dependência nova. connect-src de next.config.ts precisa incluir
// este domínio (ver VIACEP_ORIGIN) para o navegador permitir a chamada.
export interface EnderecoViaCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface RespostaViaCep {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

// `null` = CEP bem formado mas sem registro no ViaCEP (resposta `{erro:
// true}`) — nunca lançado como exceção, porque não é uma falha de
// comunicação, é um resultado válido que EnderecoForm trata sem bloquear o
// preenchimento manual. Falha de rede/HTTP/parsing continua lançando, para
// o chamador distinguir "não encontrado" de "não foi possível consultar".
export async function buscarEnderecoPorCep(
  cepSomenteDigitos: string,
): Promise<EnderecoViaCep | null> {
  const response = await fetch(`https://viacep.com.br/ws/${cepSomenteDigitos}/json/`);
  if (!response.ok) {
    throw new Error(`ViaCEP respondeu ${response.status}`);
  }

  const dados = (await response.json()) as RespostaViaCep;
  if (dados.erro) {
    return null;
  }

  return {
    logradouro: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    cidade: dados.localidade ?? "",
    estado: dados.uf ?? "",
  };
}
