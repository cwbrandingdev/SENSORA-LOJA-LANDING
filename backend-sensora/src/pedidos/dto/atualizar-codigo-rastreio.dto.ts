import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AtualizarCodigoRastreioDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  codigoRastreio?: string;
}
