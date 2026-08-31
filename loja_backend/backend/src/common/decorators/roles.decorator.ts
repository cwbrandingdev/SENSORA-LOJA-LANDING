import { SetMetadata } from '@nestjs/common';
import { PerfilUsuario } from '../../usuarios/enums/perfil-usuario.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: PerfilUsuario[]) =>
  SetMetadata(ROLES_KEY, roles);
