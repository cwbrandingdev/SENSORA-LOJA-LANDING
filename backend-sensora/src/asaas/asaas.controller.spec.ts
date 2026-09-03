import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AsaasController } from './asaas.controller';
import { AsaasService } from './asaas.service';

// Central de Integrações (Admin) — prova que o endpoint de status é um thin
// wrapper (nunca reimplementa a checagem de configuração, só chama o que
// AsaasService já expõe) e que a resposta NUNCA carrega ASAAS_API_KEY —
// só os dois campos seguros (`configured`, `baseUrl`, que é só o host, não
// segredo). Guards/Roles verificados por metadata (mesmo padrão de
// PedidosController — ver pedidos.controller.spec.ts), não por request HTTP
// real.
describe('AsaasController — status (Central de Integrações)', () => {
  it('delega para AsaasService.isConfigured()/baseUrlConfigurado e devolve só os dois campos seguros', () => {
    const asaasService = {
      isConfigured: jest.fn().mockReturnValue(true),
      baseUrlConfigurado: 'https://api.asaas.com/v3',
    };
    const controller = new AsaasController(
      asaasService as unknown as AsaasService,
    );

    const resultado = controller.status();

    expect(asaasService.isConfigured).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({
      configured: true,
      baseUrl: 'https://api.asaas.com/v3',
    });
    expect(Object.keys(resultado)).toEqual(['configured', 'baseUrl']);
  });

  it('não configurado: configured=false, baseUrl undefined (nunca inventa um host)', () => {
    const asaasService = {
      isConfigured: jest.fn().mockReturnValue(false),
      baseUrlConfigurado: undefined,
    };
    const controller = new AsaasController(
      asaasService as unknown as AsaasService,
    );

    expect(controller.status()).toEqual({ configured: false, baseUrl: undefined });
  });

  it('resposta nunca contém a API key, mesmo se o service vazasse um campo extra por engano', () => {
    const asaasService = {
      isConfigured: jest.fn().mockReturnValue(true),
      baseUrlConfigurado: 'https://api.asaas.com/v3',
      // Simula um cenário hipotético de vazamento no service — o controller
      // não deve repassar nada além do que ele monta explicitamente.
      apiKey: 'segredo-nao-deveria-aparecer',
    };
    const controller = new AsaasController(
      asaasService as unknown as AsaasService,
    );

    const resultado = JSON.stringify(controller.status());
    expect(resultado).not.toContain('segredo-nao-deveria-aparecer');
  });

  it('rota protegida por JwtAuthGuard + RolesGuard, restrita a ADMIN_ONLY_ROLES', () => {
    const guards = Reflect.getMetadata('__guards__', AsaasController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(ROLES_KEY, AsaasController) as unknown[];
    expect(roles).toEqual(ADMIN_ONLY_ROLES);
  });

  it('RolesGuard (real) nega acesso sem usuário autenticado na requisição', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ADMIN_ONLY_ROLES);
    const guard = new RolesGuard(reflector);

    const context = {
      getHandler: () => ({}),
      getClass: () => AsaasController,
      switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow();
  });
});
