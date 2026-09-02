import { PerfilUsuario } from '../enums/perfil-usuario.enum';

export class Usuario {
  id: number;
  nome: string;
  email: string;
  senha: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  // Etapa 6.4 (Confirmação de e-mail).
  emailVerificado: boolean;
  emailVerificadoEm: Date | null;
  emailVerificationHash: string | null;
  emailVerificationExpiry: Date | null;
}

export class UsuarioPublico {
  id: number;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  // Etapa 6.4 (Confirmação de e-mail) — só o booleano é público; hash/
  // expiração do token nunca saem daqui (ver Usuario, acima).
  emailVerificado: boolean;
}
