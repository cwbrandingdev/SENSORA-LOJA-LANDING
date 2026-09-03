import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Etapa 3 (Minha Conta / Dados Pessoais) — whitelist deliberadamente restrita
// a nome/email(/cpf/telefone, Etapa "Dados do Cliente / Cadastro"). NUNCA
// reaproveitar UpdateUsuarioDto aqui: aquele DTO herda perfil/ativo/senha de
// CreateUsuarioDto (uso administrativo, ver usuarios.controller.ts), e o
// ValidationPipe global (whitelist+forbidNonWhitelisted, ver main.ts) já
// rejeita com 400 qualquer campo fora desta lista — perfil/ativo/id/
// usuarioId enviados pelo corpo nunca chegam ao controller/service.
//
// cpf/telefone só validam o TIPO aqui (string opcional) — aceitam o valor
// formatado que o usuário digitou ("123.456.789-09", "(41) 99999-9999") ou
// já normalizado. A validação de verdade (dígitos verificadores do CPF,
// comprimento do telefone) e a normalização (só dígitos) acontecem em
// UsuariosService.atualizarMeusDados, reaproveitando CpfUtil/TelefoneUtil —
// checagem de negócio, não checagem de forma, por isso fica no service
// (mesmo padrão já usado para duplicidade de e-mail neste mesmo método).
// String vazia ("") é aceita de propósito: é como o campo "Adicionar"/
// "Remover" limpa o valor pelo formulário de Minha Conta.
export class AtualizarMeusDadosDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  telefone?: string;
}
