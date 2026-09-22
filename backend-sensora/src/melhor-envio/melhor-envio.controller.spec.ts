import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ADMIN_ONLY_ROLES, STAFF_ROLES } from '../common/constants/roles.constants';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MelhorEnvioController } from './melhor-envio.controller';
import { MelhorEnvioService } from './melhor-envio.service';

// Central de Integrações (Admin) — primeira suíte automatizada deste
// controller. Prova duas coisas: (1) `status`/`verificar` são thin wrappers
// sobre MelhorEnvioService (nunca reimplementam a lógica), e (2) `status`
// passou de STAFF_ROLES para ADMIN_ONLY_ROLES (mudança pedida pela
// vistoria), enquanto `conectar`/`callback` continuam exatamente como
// estavam — mesmo padrão de verificação por metadata de
// asaas.controller.spec.ts/imagekit.controller.spec.ts.
describe('MelhorEnvioController (Central de Integrações)', () => {
  it('status delega para MelhorEnvioService.obterStatusConexao() sem transformar o resultado', async () => {
    const melhorEnvioService = {
      obterStatusConexao: jest.fn().mockResolvedValue({
        configured: true,
        conectado: true,
        ambiente: 'sandbox',
        expiresAt: '2026-12-31T23:59:59.000Z',
      }),
    };
    const controller = new MelhorEnvioController(
      melhorEnvioService as unknown as MelhorEnvioService,
    );

    await expect(controller.status()).resolves.toEqual({
      configured: true,
      conectado: true,
      ambiente: 'sandbox',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });
    expect(melhorEnvioService.obterStatusConexao).toHaveBeenCalledTimes(1);
  });

  it('verificar delega para MelhorEnvioService.verificarOperacional() sem transformar o resultado', async () => {
    const melhorEnvioService = {
      verificarOperacional: jest
        .fn()
        .mockResolvedValue({ operational: false, mensagem: 'x' }),
    };
    const controller = new MelhorEnvioController(
      melhorEnvioService as unknown as MelhorEnvioService,
    );

    await expect(controller.verificar()).resolves.toEqual({
      operational: false,
      mensagem: 'x',
    });
    expect(melhorEnvioService.verificarOperacional).toHaveBeenCalledTimes(1);
  });

  it('conectar delega para MelhorEnvioService.gerarUrlAutorizacao()', () => {
    const melhorEnvioService = {
      gerarUrlAutorizacao: jest.fn().mockReturnValue('https://sandbox.melhorenvio.com.br/oauth/authorize?x'),
    };
    const controller = new MelhorEnvioController(
      melhorEnvioService as unknown as MelhorEnvioService,
    );

    expect(controller.conectar()).toEqual({
      url: 'https://sandbox.melhorenvio.com.br/oauth/authorize?x',
    });
  });

  it('status é ADMIN_ONLY_ROLES (mudou de STAFF_ROLES nesta vistoria)', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      MelhorEnvioController.prototype.status,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(
      ROLES_KEY,
      MelhorEnvioController.prototype.status,
    ) as unknown[];
    expect(roles).toEqual(ADMIN_ONLY_ROLES);
  });

  it('verificar é ADMIN_ONLY_ROLES, mesmo padrão de status', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      MelhorEnvioController.prototype.verificar,
    ) as unknown[];
    expect(roles).toEqual(ADMIN_ONLY_ROLES);
  });

  it('conectar continua STAFF_ROLES — intocado por esta vistoria', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      MelhorEnvioController.prototype.conectar,
    ) as unknown[];
    expect(roles).toEqual(STAFF_ROLES);
  });

  it('callback continua sem JwtAuthGuard/RolesGuard — intocado por esta vistoria', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      MelhorEnvioController.prototype.callback,
    ) as unknown[] | undefined;
    expect(guards).toBeUndefined();
  });

  it('RolesGuard (real): VENDEDOR autenticado é negado em status agora que exige ADMIN_ONLY_ROLES', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ADMIN_ONLY_ROLES);
    const guard = new RolesGuard(reflector);

    const context = {
      getHandler: () => MelhorEnvioController.prototype.status,
      getClass: () => MelhorEnvioController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 1, perfil: 'VENDEDOR' } }),
      }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow();
  });
});
