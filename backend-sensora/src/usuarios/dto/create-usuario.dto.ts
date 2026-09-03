import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PerfilUsuario } from '../enums/perfil-usuario.enum';

export class CreateUsuarioDto {
  // Etapa 10 / Task 6 (achado H8)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @IsEmail()
  email: string;

  // Etapa 10 / Task 6 (achado H11): mínimo elevado de 6 para 8 caracteres.
  @IsString()
  @MinLength(8)
  senha: string;

  @IsEnum(PerfilUsuario)
  perfil: PerfilUsuario;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;

  // Etapa "Dados do Cliente / Cadastro" (fechamento administrativo) — mesmo
  // contrato de AtualizarMeusDadosDto: só valida o TIPO aqui (string
  // opcional), aceitando formatado ou já normalizado. Validação de verdade
  // (dígitos verificadores do CPF, comprimento do telefone), normalização e
  // checagem de duplicidade de CPF acontecem em UsuariosService (create/
  // update), reaproveitando CpfUtil/TelefoneUtil — mesma lógica do
  // self-service, chamada a partir do fluxo administrativo (ADMIN via
  // UsuariosController, rotas já protegidas por @Roles(ADMIN_ONLY_ROLES)).
  // String vazia ("") limpa o campo, igual ao self-service.
  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  telefone?: string;
}
