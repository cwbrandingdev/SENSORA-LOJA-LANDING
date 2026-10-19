import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAXIMO_COMENTARIO_AVALIACAO = 2000;

export class SalvarAvaliacaoDto {
  @IsInt()
  @Min(1)
  @Max(5)
  nota: number;

  @IsString()
  @IsOptional()
  @MaxLength(MAXIMO_COMENTARIO_AVALIACAO)
  comentario?: string;
}
