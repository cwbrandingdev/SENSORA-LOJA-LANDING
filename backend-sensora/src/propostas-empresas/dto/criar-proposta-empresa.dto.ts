import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NormalizarEmail } from '../../common/utils/email.util';
import {
  CARGOS_PROPOSTA,
  OBJETIVOS_PROPOSTA,
  QUANTIDADES_PROPOSTA,
} from '../opcoes';

// Formulário público (sem conta). A ValidationPipe global recusa qualquer
// campo não declarado aqui (whitelist + forbidNonWhitelisted, ver main.ts).
export class CriarPropostaEmpresaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;

  @NormalizarEmail()
  @IsEmail()
  @MaxLength(200)
  email: string;

  // Só os dígitos contam (validado no service).
  @IsString()
  @MaxLength(20)
  telefone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  empresa: string;

  @IsIn(CARGOS_PROPOSTA)
  cargo: string;

  @IsIn(OBJETIVOS_PROPOSTA)
  objetivo: string;

  @IsIn(QUANTIDADES_PROPOSTA)
  quantidade: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mensagem?: string;

  // Armadilha para robôs: campo escondido na página. Preenchido = robô.
  @IsOptional()
  @IsString()
  site?: string;
}
