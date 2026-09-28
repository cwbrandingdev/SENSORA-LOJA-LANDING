import { Transform } from 'class-transformer';

// Única fonte de verdade para a forma canônica de um e-mail: sem espaços
// nas pontas e em minúsculas. Aplicada tanto na entrada (DTOs, via
// @NormalizarEmail) quanto antes de gravar/comparar (UsuariosService), para
// que "TESTE@GMAIL.COM " e "teste@gmail.com" sejam sempre a mesma conta.
// Os registros existentes já estavam nesta forma (conferido no banco antes
// desta mudança), então nenhuma migração de dados foi necessária.
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Decorator para DTOs. Roda antes do @IsEmail() (o ValidationPipe aplica o
// class-transformer antes do class-validator), então espaços nas pontas não
// reprovam mais um e-mail válido. Valores que não são string passam intactos
// para o @IsEmail() rejeitar normalmente.
export function NormalizarEmail(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizarEmail(value) : value,
  );
}
