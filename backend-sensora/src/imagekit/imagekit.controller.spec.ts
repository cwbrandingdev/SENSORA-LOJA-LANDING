import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ADMIN_ONLY_ROLES, STAFF_ROLES } from '../common/constants/roles.constants';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ImagekitController } from './imagekit.controller';
import { ImagekitService } from './imagekit.service';

// Central de Integrações (Admin) — mesmo raciocínio de
// asaas.controller.spec.ts, mas o endpoint novo (`status`) foi acrescentado
// a um controller já existente (`ImagekitController`), cuja classe inteira é
// STAFF_ROLES (upload de produto, ADMIN+VENDEDOR — Etapa 7). O ponto central
// desta suíte é provar que o @Roles(...ADMIN_ONLY_ROLES) por método
// sobrescreve o STAFF_ROLES da classe só para `status`, sem afetar `auth`
// (upload de imagem de produto continua ADMIN+VENDEDOR, intocado).
describe('ImagekitController — status (Central de Integrações)', () => {
  it('delega para ImagekitService.isConfigured() e devolve só { configured }', () => {
    const imagekitService = { isConfigured: jest.fn().mockReturnValue(true) };
    const controller = new ImagekitController(
      imagekitService as unknown as ImagekitService,
    );

    const resultado = controller.status();

    expect(imagekitService.isConfigured).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ configured: true });
    expect(Object.keys(resultado)).toEqual(['configured']);
  });

  it('não configurado: configured=false', () => {
    const imagekitService = { isConfigured: jest.fn().mockReturnValue(false) };
    const controller = new ImagekitController(
      imagekitService as unknown as ImagekitService,
    );

    expect(controller.status()).toEqual({ configured: false });
  });

  it('classe continua sob JwtAuthGuard + RolesGuard (upload de imagem intocado)', () => {
    const guards = Reflect.getMetadata('__guards__', ImagekitController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('GET /imagekit/auth (upload) continua STAFF_ROLES — nunca restringido por esta tarefa', () => {
    const rolesDaClasse = Reflect.getMetadata(ROLES_KEY, ImagekitController) as unknown[];
    expect(rolesDaClasse).toEqual(STAFF_ROLES);

    // `auth` não tem @Roles próprio — herda o da classe via
    // getAllAndOverride, então não deve ter metadata direto no método.
    const rolesDoMetodoAuth = Reflect.getMetadata(
      ROLES_KEY,
      ImagekitController.prototype.auth,
    ) as unknown[] | undefined;
    expect(rolesDoMetodoAuth).toBeUndefined();
  });

  it('GET /imagekit/status é ADMIN-only — @Roles de método sobrescreve o STAFF_ROLES da classe', () => {
    const rolesDoMetodoStatus = Reflect.getMetadata(
      ROLES_KEY,
      ImagekitController.prototype.status,
    ) as unknown[];
    expect(rolesDoMetodoStatus).toEqual(ADMIN_ONLY_ROLES);
  });

  it('RolesGuard (real): VENDEDOR autenticado é negado quando os roles exigidos são ADMIN_ONLY_ROLES (simula GET /imagekit/status)', () => {
    const reflector = new Reflector();
    // getAllAndOverride([handler, class]) devolveria ADMIN_ONLY_ROLES para
    // `status` (metadata de método vence a de classe) — reproduzido aqui
    // mockando o retorno diretamente, sem depender da ordem interna do
    // Reflector real.
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ADMIN_ONLY_ROLES);
    const guard = new RolesGuard(reflector);

    const context = {
      getHandler: () => ImagekitController.prototype.status,
      getClass: () => ImagekitController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 1, perfil: 'VENDEDOR' } }),
      }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow();
  });
});
