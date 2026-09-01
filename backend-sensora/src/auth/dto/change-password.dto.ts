import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// Etapa 3 (Minha Conta / Segurança) — DTO próprio, nunca reaproveita
// UpdateUsuarioDto (administrativo) nem ResetPasswordDto (fluxo de token,
// sem senha atual). Exige a senha atual — diferente do reset via e-mail,
// aqui o usuário já está autenticado, mas precisamos confirmar que é
// realmente ele quem está trocando a senha (não uma sessão sequestrada
// através de um token roubado).
export class AlterarMinhaSenhaDto {
  @IsString()
  @IsNotEmpty()
  senhaAtual: string;

  // Mesma política já usada em CreateUsuarioDto/RegisterDto/ResetPasswordDto
  // (Etapa 10 / Task 6, achado H11): mínimo de 8 caracteres.
  @IsString()
  @MinLength(8)
  novaSenha: string;
}
