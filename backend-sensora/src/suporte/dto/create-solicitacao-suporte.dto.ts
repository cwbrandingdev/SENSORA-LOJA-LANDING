import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CategoriaSuporte } from '../enums/categoria-suporte.enum';

export const TAMANHO_MAXIMO_ASSUNTO = 150;
export const TAMANHO_MAXIMO_MENSAGEM = 5000;

// O cliente informa só categoria, assunto e mensagem — nunca usuário, nome,
// e-mail ou status (a ValidationPipe global rejeita qualquer campo que não
// esteja declarado aqui, ver main.ts: whitelist + forbidNonWhitelisted).
// Texto só com espaços é recusado no service, depois do trim.
export class CreateSolicitacaoSuporteDto {
  @IsEnum(CategoriaSuporte)
  categoria: CategoriaSuporte;

  @IsString()
  @IsNotEmpty()
  @MaxLength(TAMANHO_MAXIMO_ASSUNTO)
  assunto: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(TAMANHO_MAXIMO_MENSAGEM)
  mensagem: string;
}
