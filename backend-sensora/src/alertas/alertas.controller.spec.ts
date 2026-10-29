import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';

const ADMIN = { id: 7, email: 'admin@sensora.dev', perfil: 'ADMIN' as const };

// Vistoria de Alertas Operacionais (Admin) — mesmo raciocínio de
// dashboard.controller.spec.ts/asaas.controller.spec.ts: prova que o
// endpoint é um thin wrapper (nunca reimplementa a agregação, só chama o
// que AlertasService já expõe) e que a rota é ADMIN-only. Guards/Roles
// verificados por metadata, não por request HTTP real.
describe('AlertasController — GET /alertas', () => {
  it('delega para AlertasService.obterAlertas() sem transformar o resultado', async () => {
    const alertasFake = [
      {
        tipo: 'ESTOQUE_BAIXO' as const,
        severidade: 'warning' as const,
        titulo: 'Produtos com estoque baixo ou esgotado',
        quantidade: 3,
        link: '/workspace-x/produtos',
      },
    ];
    const alertasService = {
      obterAlertas: jest.fn().mockResolvedValue(alertasFake),
    };
    const controller = new AlertasController(
      alertasService as unknown as AlertasService,
    );

    await expect(controller.obterAlertas(ADMIN)).resolves.toEqual(alertasFake);
    expect(alertasService.obterAlertas).toHaveBeenCalledWith(ADMIN.id);
  });

  it('lista vazia (sem alertas) é devolvida tal como veio do service', async () => {
    const alertasService = { obterAlertas: jest.fn().mockResolvedValue([]) };
    const controller = new AlertasController(
      alertasService as unknown as AlertasService,
    );

    await expect(controller.obterAlertas(ADMIN)).resolves.toEqual([]);
  });

  it('DELETE /alertas/:tipo delega excluirAlerta com o id do token', async () => {
    const alertasService = {
      excluirAlerta: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new AlertasController(
      alertasService as unknown as AlertasService,
    );

    await controller.excluirAlerta(ADMIN, { tipo: 'ESTOQUE_BAIXO' });

    expect(alertasService.excluirAlerta).toHaveBeenCalledWith(
      ADMIN.id,
      'ESTOQUE_BAIXO',
    );
  });

  it('rota protegida por JwtAuthGuard + RolesGuard, restrita a ADMIN_ONLY_ROLES', () => {
    const guards = Reflect.getMetadata('__guards__', AlertasController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(ROLES_KEY, AlertasController) as unknown[];
    expect(roles).toEqual(ADMIN_ONLY_ROLES);
  });

  it('RolesGuard (real) nega acesso a VENDEDOR autenticado (ADMIN_ONLY_ROLES)', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ADMIN_ONLY_ROLES);
    const guard = new RolesGuard(reflector);

    const context = {
      getHandler: () => ({}),
      getClass: () => AlertasController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 1, perfil: 'VENDEDOR' } }),
      }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow();
  });
});
