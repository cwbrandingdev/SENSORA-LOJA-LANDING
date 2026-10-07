import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ResultadoOcorrencia } from '../enums/resultado-ocorrencia.enum';
import { TipoOcorrencia } from '../enums/tipo-ocorrencia.enum';

// GET /admin/ocorrencias — todos os filtros opcionais. Ordenação fixa
// (criadoEm DESC), nunca escolhida pelo cliente. Datas em ISO 8601; uma
// data sem hora em `dataFim` vale até o fim daquele dia (UTC).
export class ListarOcorrenciasQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsEnum(TipoOcorrencia)
  tipo?: TipoOcorrencia;

  @IsOptional()
  @IsEnum(ResultadoOcorrencia)
  resultado?: ResultadoOcorrencia;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  codigo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usuarioId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pedidoId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  devolucaoId?: number;

  @IsOptional()
  @IsISO8601()
  dataInicio?: string;

  @IsOptional()
  @IsISO8601()
  dataFim?: string;
}
