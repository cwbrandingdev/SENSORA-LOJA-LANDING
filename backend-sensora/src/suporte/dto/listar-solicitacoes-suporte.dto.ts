import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CategoriaSuporte } from '../enums/categoria-suporte.enum';
import { StatusSolicitacaoSuporte } from '../enums/status-solicitacao-suporte.enum';

// GET /admin/suporte — mesmo formato de paginação de
// ocorrencias/dto/listar-ocorrencias.dto.ts. Ordenação fixa (criadaEm DESC).
export class ListarSolicitacoesSuporteQueryDto {
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
  @IsEnum(StatusSolicitacaoSuporte)
  status?: StatusSolicitacaoSuporte;

  @IsOptional()
  @IsEnum(CategoriaSuporte)
  categoria?: CategoriaSuporte;
}
