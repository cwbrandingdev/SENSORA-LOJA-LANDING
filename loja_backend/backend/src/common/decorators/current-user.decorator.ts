import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/interfaces/usuario-autenticado.interface';

// Lê o usuário já populado em request.user pelo JwtStrategy (Etapa 10 /
// Task 3) — não é um mecanismo de autenticação novo, só uma forma limpa de
// os controllers acessarem o que o JwtAuthGuard já validou, para as
// checagens de propriedade/escopo da Task 5 (achado A6).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: UsuarioAutenticado }>();
    return request.user;
  },
);
