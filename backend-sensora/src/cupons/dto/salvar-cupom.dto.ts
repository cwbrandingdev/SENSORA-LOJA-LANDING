import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PublicoCupom } from '../enums/publico-cupom.enum';
import { TipoDescontoCupom } from '../enums/tipo-desconto-cupom.enum';

export class SalvarCupomDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'O código deve ter só letras e números, sem espaço.',
  })
  codigo: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(140)
  mensagem: string;

  @IsEnum(TipoDescontoCupom)
  tipoDesconto: TipoDescontoCupom;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(100000)
  valor: number;

  @IsEnum(PublicoCupom)
  publico: PublicoCupom;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  usuarioIds?: number[];

  @IsBoolean()
  ativo: boolean;

  @IsBoolean()
  mostrarNoTopo: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? null : Number(value),
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorMinimo?: number | null;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? null : Number(value),
  )
  @IsInt()
  @IsPositive()
  limiteUsos?: number | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? null : value))
  @IsDateString()
  inicioEm?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? null : value))
  @IsDateString()
  fimEm?: string | null;
}
