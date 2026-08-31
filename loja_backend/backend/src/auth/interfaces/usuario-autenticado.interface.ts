import { PerfilUsuario } from '../../usuarios/enums/perfil-usuario.enum';

export interface UsuarioAutenticado {
  id: number;
  email: string;
  perfil: PerfilUsuario;
}
