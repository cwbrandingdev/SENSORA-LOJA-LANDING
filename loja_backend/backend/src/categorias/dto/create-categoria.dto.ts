import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoriaDto {
  // Etapa 10 / Task 6 (achado H8): limite de tamanho em campos de texto
  // livre, coerente com a finalidade de cada campo.
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  descricao?: string;
}
