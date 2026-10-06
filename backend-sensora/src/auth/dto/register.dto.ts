import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizarEmail } from '../../common/utils/email.util';

export class RegisterDto {
  // Etapa 10 / Task 6 (achado H8)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @NormalizarEmail()
  @IsEmail()
  email: string;

  // Etapa 10 / Task 6 (achado H11): mínimo elevado de 6 para 8 caracteres.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  senha: string;

  // Obrigatório no cadastro público: a nota fiscal da compra usa este CPF.
  // Dígitos verificadores e duplicidade ficam em UsuariosService.create.
  @IsString()
  @IsNotEmpty()
  cpf: string;
}
