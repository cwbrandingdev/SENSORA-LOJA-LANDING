// Formulário "Para empresas". Espelho das listas do backend
// (backend-sensora/src/propostas-empresas/opcoes.ts): a API só aceita
// exatamente estes textos.

export const CARGOS_PROPOSTA = [
  "Sócio(a) / Diretoria",
  "Gerência / Coordenação",
  "Marketing / Comunicação",
  "RH / Pessoas",
  "Compras",
  "Outro",
] as const;

export const OBJETIVOS_PROPOSTA = [
  "Presente para colaboradores",
  "Presente para clientes e parceiros",
  "Evento corporativo",
  "Ação de marca / press kit",
  "Datas comemorativas",
  "Outro",
] as const;

export const PEDIDO_MINIMO_EMPRESAS = 30;

export const QUANTIDADES_PROPOSTA = [
  "30 a 99 unidades",
  "100 a 299 unidades",
  "300 a 499 unidades",
  "500 unidades ou mais",
] as const;

export type StatusPropostaEmpresa = "NOVA" | "EM_CONTATO" | "ENCERRADA";

export type NovaPropostaEmpresa = {
  nome: string;
  email: string;
  telefone: string;
  empresa: string;
  cargo: string;
  objetivo: string;
  quantidade: string;
  mensagem?: string;
  /** Armadilha para robôs: fica escondido na página e sempre vazio. */
  site?: string;
};

export type PropostaEmpresa = Omit<NovaPropostaEmpresa, "site"> & {
  id: number;
  mensagem: string | null;
  status: StatusPropostaEmpresa;
  criadaEm: string;
};
