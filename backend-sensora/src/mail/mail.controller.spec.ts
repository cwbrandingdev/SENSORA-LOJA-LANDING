import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

// Central de Integrações (Admin) — mesmo raciocínio de
// asaas.controller.spec.ts: thin wrapper sobre MailService.isConfigured()
// (já existente e usado internamente por enviarEmail(), nunca duplicado
// aqui), resposta restrita a `{ configured }` — nunca RESEND_API_KEY nem
// EMAIL_FROM.
describe('MailController — status (Central de Integrações)', () => {
  it('delega para MailService.isConfigured() e devolve só { configured }', () => {
    const mailService = { isConfigured: jest.fn().mockReturnValue(true) };
    const controller = new MailController(mailService as unknown as MailService);

    const resultado = controller.status();

    expect(mailService.isConfigured).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ configured: true });
    expect(Object.keys(resultado)).toEqual(['configured']);
  });

  it('não configurado: configured=false', () => {
    const mailService = { isConfigured: jest.fn().mockReturnValue(false) };
    const controller = new MailController(mailService as unknown as MailService);

    expect(controller.status()).toEqual({ configured: false });
  });

  it('rota protegida por JwtAuthGuard + RolesGuard, restrita a ADMIN_ONLY_ROLES', () => {
    const guards = Reflect.getMetadata('__guards__', MailController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(ROLES_KEY, MailController) as unknown[];
    expect(roles).toEqual(ADMIN_ONLY_ROLES);
  });

  it('RolesGuard (real) nega acesso sem usuário autenticado na requisição', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ADMIN_ONLY_ROLES);
    const guard = new RolesGuard(reflector);

    const context = {
      getHandler: () => ({}),
      getClass: () => MailController,
      switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow();
  });
});
