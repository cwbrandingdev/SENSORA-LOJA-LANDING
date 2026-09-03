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
  // Etapa — Dados do Cliente / Cadastro. Sempre normalizados (só dígitos)
  // quando presentes — ver UsuariosService.
  cpf: string | null;
  telefone: string | null;
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
  // Etapa — Dados do Cliente / Cadastro. Ambos opcionais/nuláveis — nunca a
  // senha, nunca dados administrativos (perfil/ativo já eram públicos antes
  // desta etapa, sem mudança).
  cpf: string | null;
  telefone: string | null;
}
