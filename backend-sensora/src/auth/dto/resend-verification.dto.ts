import { IsEmail } from 'class-validator';
import { NormalizarEmail } from '../../common/utils/email.util';

export class ResendVerificationDto {
  @NormalizarEmail()
  @IsEmail()
  email: string;
}
