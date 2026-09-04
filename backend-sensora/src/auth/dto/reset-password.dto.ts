import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  // Etapa 8.10 (hardening LOW): resetToken é sempre
  // randomBytes(32).toString('hex') — exatamente 64 caracteres (ver
  // AuthService.forgotPassword) —, nunca varia. Mesmo raciocínio de
  // RefreshTokenDto: só rejeita, antes do hash + consulta, entradas que já
  // nunca corresponderiam a nada válido.
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  token: string;

  // Etapa 10 / Task 6 (achado H11): mínimo elevado de 6 para 8 caracteres.
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  novaSenha: string;
}
