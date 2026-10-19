import { IsEnum, IsOptional } from 'class-validator';
import { StatusAvaliacao } from '../enums/status-avaliacao.enum';

export class ListarAvaliacoesQueryDto {
  @IsOptional()
  @IsEnum(StatusAvaliacao)
  status?: StatusAvaliacao;
}
