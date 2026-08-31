import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateEnderecoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  rua: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  numero: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  complemento?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bairro: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cidade: string;

  @IsString()
  @Length(2, 2, { message: 'estado deve ser a sigla da UF (2 letras)' })
  estado: string;

  @IsString()
  @Matches(/^\d{5}-?\d{3}$/, {
    message: 'cep deve estar no formato 00000-000 ou 00000000',
  })
  cep: string;

  @IsBoolean()
  @IsOptional()
  padrao?: boolean;
}
