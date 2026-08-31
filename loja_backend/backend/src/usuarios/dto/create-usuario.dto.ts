import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PerfilUsuario } from '../enums/perfil-usuario.enum';

export class CreateUsuarioDto {
  // Etapa 10 / Task 6 (achado H8)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @IsEmail()
  email: string;

  // Etapa 10 / Task 6 (achado H11): mínimo elevado de 6 para 8 caracteres.
  @IsString()
  @MinLength(8)
  senha: string;

  @IsEnum(PerfilUsuario)
  perfil: PerfilUsuario;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}
