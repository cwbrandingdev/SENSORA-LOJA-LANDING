import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyEmailDto {
  // Etapa 8.10 (hardening LOW): emailVerificationToken é sempre
  // randomBytes(32).toString('hex') — exatamente 64 caracteres (ver
  // AuthService.register/resendVerification) —, nunca varia. Mesmo
  // raciocínio de RefreshTokenDto/ResetPasswordDto.
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  token: string;
}
