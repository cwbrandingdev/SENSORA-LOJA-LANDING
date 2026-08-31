import { IsNotEmpty, IsString } from 'class-validator';

// Reaproveitado por POST /auth/refresh e POST /auth/logout — os dois
// recebem exatamente o mesmo corpo (o refresh token a validar/revogar),
// então um único DTO evita duplicar a mesma validação (Task 27).
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
