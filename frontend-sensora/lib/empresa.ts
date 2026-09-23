// Identificação do fornecedor exigida pelo Decreto 7.962/2013, art. 2º.
// Razão social, CNPJ, CEP, cidade e complemento saem do cadastro público
// da Receita (consulta em 22/09/2026). O e-mail é o canal que o site já usa.

export const EMPRESA = {
  nomeFantasia: "Sensora",
  razaoSocial: "Cazarim & Souza Ltda",
  cnpj: "48.942.001/0001-81",
  endereco: "Rua Ébano Pereira, 11, conj. 1403, 14º andar, Edifício Avenida",
  bairro: "Centro",
  cidade: "Curitiba",
  uf: "PR",
  cep: "80410-240",
  email: "suporte@sensorahome.com.br",
  instagram: "@sensoramarketingsensorial",
  instagramUrl: "https://www.instagram.com/sensoramarketingsensorial/",
  atualizadoEm: "22 de setembro de 2026",
} as const;

export const ENDERECO_LINHA = `${EMPRESA.endereco}, ${EMPRESA.bairro}, ${EMPRESA.cidade}/${EMPRESA.uf}, CEP ${EMPRESA.cep}`;

export const ROTAS_LEGAIS = {
  quemSomos: "/quem-somos",
  termos: "/termos-de-uso",
  privacidade: "/politica-de-privacidade",
  cookies: "/politica-de-cookies",
  trocas: "/trocas-e-devolucoes",
} as const;

export function mailtoAssunto(assunto: string, corpo: string): string {
  return `mailto:${EMPRESA.email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}
