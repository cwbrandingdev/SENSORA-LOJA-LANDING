import { PerfilUsuario } from '../../usuarios/enums/perfil-usuario.enum';

export interface JwtPayload {
  sub: number;
  email: string;
  perfil: PerfilUsuario;
}
