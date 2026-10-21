import { IsIn } from 'class-validator';
import { StatusAvaliacao } from '../enums/status-avaliacao.enum';

// O Admin só aprova ou recusa; PENDENTE é o estado de quem acabou de
// avaliar (ou editou a avaliação).
export class AtualizarStatusAvaliacaoDto {
  @IsIn([StatusAvaliacao.APROVADA, StatusAvaliacao.RECUSADA])
  status: StatusAvaliacao.APROVADA | StatusAvaliacao.RECUSADA;
}
