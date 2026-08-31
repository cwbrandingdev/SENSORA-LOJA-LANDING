import { PerfilUsuario } from '../enums/perfil-usuario.enum';

export class Usuario {
  id: number;
  nome: string;
  email: string;
  senha: string;
  perfil: PerfilUsuario;
  ativo: boolean;
}

export class UsuarioPublico {
  id: number;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
}
