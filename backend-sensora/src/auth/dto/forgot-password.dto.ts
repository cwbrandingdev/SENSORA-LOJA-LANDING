import { IsEmail } from 'class-validator';
import { NormalizarEmail } from '../../common/utils/email.util';

export class ForgotPasswordDto {
  @NormalizarEmail()
  @IsEmail()
  email: string;
}
