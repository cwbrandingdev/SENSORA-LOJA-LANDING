import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsuarioAutenticado } from '../../auth/interfaces/usuario-autenticado.interface';
import { PerfilUsuario } from '../../usuarios/enums/perfil-usuario.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Reutilizável via @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(...) — não
// precisa ser registrado em nenhum module.providers: passado por referência
// de classe em @UseGuards(), o Nest resolve o Reflector (provider global do
// framework) sozinho.
//
// Etapa 10 / Task 6 (achado H7): fail-closed — se a rota usa RolesGuard mas
// esqueceu @Roles(...), o acesso é NEGADO por padrão (antes, deixava
// passar qualquer usuário autenticado, inclusive CLIENTE, o que era um
// risco de manutenção futura: bastava alguém esquecer o @Roles() num
// controller novo). Confirmado por auditoria que nenhuma rota atual depende
// do comportamento antigo — todos os controllers que usam RolesGuard já
// declaram @Roles() explicitamente. Rotas genuinamente públicas (auth,
// public, /) simplesmente não usam RolesGuard — não é necessário nenhum
// decorator @Public() para isso.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PerfilUsuario[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException('Acesso negado');
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user: UsuarioAutenticado }>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.perfil)) {
      throw new ForbiddenException('Acesso negado');
    }

    return true;
  }
}
