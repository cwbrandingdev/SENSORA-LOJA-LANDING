import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Corpo de POST /admin/devolucoes/:id/aprovar e .../recusar. Só a
// observação vem do cliente HTTP: status, data e quem analisou são sempre
// definidos pelo backend (a ValidationPipe global rejeita qualquer outro
// campo — whitelist + forbidNonWhitelisted, ver main.ts).
export class AprovarDevolucaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;
}

// Na recusa, a observação é obrigatória (vai no e-mail ao cliente). Texto
// só com espaços é recusado no service.
export class RecusarDevolucaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  observacao: string;
}
