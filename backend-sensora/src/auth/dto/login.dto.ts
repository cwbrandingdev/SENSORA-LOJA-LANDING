import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { NormalizarEmail } from '../../common/utils/email.util';

export class LoginDto {
  @NormalizarEmail()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  senha: string;
}
