import { IsIn } from 'class-validator';
import { StatusSolicitacaoSuporte } from '../enums/status-solicitacao-suporte.enum';

// ABERTA é só o estado inicial: o Admin nunca volta uma solicitação para ele.
export const STATUS_DESTINO_SUPORTE = [
  StatusSolicitacaoSuporte.EM_ATENDIMENTO,
  StatusSolicitacaoSuporte.RESOLVIDA,
] as const;

export class AtualizarStatusSuporteDto {
  @IsIn(STATUS_DESTINO_SUPORTE)
  status: (typeof STATUS_DESTINO_SUPORTE)[number];
}
