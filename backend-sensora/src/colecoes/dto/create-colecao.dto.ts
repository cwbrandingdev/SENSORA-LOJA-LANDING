import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateColecaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  chamada?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  titulo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  descricao?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  imagemUrl?: string;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;

  // Lista completa dos produtos da coleção — substitui a anterior.
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  produtoIds?: number[];
}
