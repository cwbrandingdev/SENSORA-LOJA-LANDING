import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Reaproveitado por POST /auth/refresh e POST /auth/logout — os dois
// recebem exatamente o mesmo corpo (o refresh token a validar/revogar),
// então um único DTO evita duplicar a mesma validação (Task 27).
export class RefreshTokenDto {
  // Etapa 8.10 (hardening LOW): o refresh token real é sempre
  // randomBytes(32).toString('hex') — exatamente 64 caracteres (ver
  // AuthService.gerarParDeTokens) —, nunca varia. @MaxLength(64) só rejeita
  // entradas que já eram inválidas (nunca corresponderiam a nenhum hash no
  // banco), antes de gastar um SHA-256 + consulta no Prisma com um valor
  // absurdamente grande.
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  refresh_token: string;
}
