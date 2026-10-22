import { IsIn } from 'class-validator';

// NOVA é só o estado inicial; o Admin pode ir e voltar entre os outros.
export const STATUS_PROPOSTA = ['NOVA', 'EM_CONTATO', 'ENCERRADA'] as const;
export type StatusProposta = (typeof STATUS_PROPOSTA)[number];

export class AtualizarStatusPropostaDto {
  @IsIn(STATUS_PROPOSTA)
  status: StatusProposta;
}
