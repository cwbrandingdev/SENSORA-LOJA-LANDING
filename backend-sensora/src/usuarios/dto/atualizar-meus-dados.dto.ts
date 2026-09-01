import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Etapa 3 (Minha Conta / Dados Pessoais) — whitelist deliberadamente restrita
// a nome/email. NUNCA reaproveitar UpdateUsuarioDto aqui: aquele DTO herda
// perfil/ativo/senha de CreateUsuarioDto (uso administrativo, ver
// usuarios.controller.ts), e o ValidationPipe global
// (whitelist+forbidNonWhitelisted, ver main.ts) já rejeita com 400 qualquer
// campo fora desta lista — perfil/ativo/id/usuarioId enviados pelo corpo
// nunca chegam ao controller/service.
export class AtualizarMeusDadosDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @IsEmail()
  email: string;
}
