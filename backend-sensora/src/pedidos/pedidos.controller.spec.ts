import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { STAFF_ROLES } from '../common/constants/roles.constants';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

// Etapa 5B.4 (item 19.C — "sem autenticação retorna 401") — o mecanismo de
// autenticação em si (JwtAuthGuard = Passport 'jwt') não é reimplementado
// nem testado aqui: é o MESMO guard, aplicado no MESMO nível de classe
// (`@UseGuards(JwtAuthGuard, RolesGuard)` em PedidosController), que já
// protege todas as outras rotas do controller (findAll, cancelarMeuPedido
// etc.) — não há nenhum decorator de bypass (@Public()-like) neste
// codebase. O que esta suíte prova, sem duplicar a garantia já dada pelo
// Passport:
// 1) a nova rota está sob os mesmos guards de classe (nenhum
//    @UseGuards()/@SkipAuth por método a contorná-los);
// 2) o controller delega para PedidosService.solicitarReembolso com o id e
//    o `@CurrentUser()` corretos (nunca lê nada do body);
// 3) RolesGuard (2º guard da cadeia, dependente de `request.user` já
//    populado pelo JwtAuthGuard) nega o acesso quando não há usuário
//    autenticado — mesmo com @Roles(...) configurado na rota — usando a
//    implementação REAL do guard, não uma dublê.
describe('PedidosController — solicitarReembolsoMeuPedido (Etapa 5B.4)', () => {
  it('delega para PedidosService.solicitarReembolso com o id da URL e o usuário do @CurrentUser', async () => {
    const pedidoRetornado = { id: 1 };
    const pedidosService = {
      solicitarReembolso: jest.fn().mockResolvedValue(pedidoRetornado),
    };
    const controller = new PedidosController(
      pedidosService as unknown as PedidosService,
    );
    const user: UsuarioAutenticado = {
      id: 7,
      email: 'cliente@sensora.dev',
      perfil: PerfilUsuario.CLIENTE,
    };

    const resultado = await controller.solicitarReembolsoMeuPedido(1, user);

    expect(pedidosService.solicitarReembolso).toHaveBeenCalledWith(1, user);
    expect(resultado).toBe(pedidoRetornado);
  });

  it('a rota está sob os mesmos guards de classe (JwtAuthGuard + RolesGuard) de todo o controller, sem bypass', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      PedidosController,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('RolesGuard (real, não mockado) nega acesso quando não há usuário autenticado na requisição', () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([PerfilUsuario.CLIENTE]);
    const guard = new RolesGuard(reflector);

    const context = {
      getHandler: () => ({}),
      getClass: () => PedidosController,
      switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

// Tarefa "Ordenar pedidos do Admin do mais recente para o mais antigo" —
// prova que GET /pedidos (listagem do Admin) pede a ordenação ao service,
// e que GET /pedidos/meus (Minha Conta) continua chamando findAll sem
// nenhuma opção — comportamento daquela rota preservado byte a byte.
describe('PedidosController — findAll/findMeusPedidos (ordenação da listagem do Admin)', () => {
  it('findAll (GET /pedidos): delega para PedidosService.findAll com { ordenarPorDataDesc: true }', async () => {
    const pedidosRetornados = [{ id: 2 }, { id: 1 }];
    const pedidosService = { findAll: jest.fn().mockResolvedValue(pedidosRetornados) };
    const controller = new PedidosController(
      pedidosService as unknown as PedidosService,
    );
    const admin: UsuarioAutenticado = {
      id: 1,
      email: 'admin@sensora.dev',
      perfil: PerfilUsuario.ADMIN,
    };

    const resultado = await controller.findAll(admin);

    expect(pedidosService.findAll).toHaveBeenCalledWith(admin, {
      ordenarPorDataDesc: true,
    });
    expect(resultado).toBe(pedidosRetornados);
  });

  it('findMeusPedidos (GET /pedidos/meus): delega para PedidosService.findAll sem opções (ordem inalterada)', async () => {
    const pedidosService = { findAll: jest.fn().mockResolvedValue([]) };
    const controller = new PedidosController(
      pedidosService as unknown as PedidosService,
    );
    const cliente: UsuarioAutenticado = {
      id: 7,
      email: 'cliente@sensora.dev',
      perfil: PerfilUsuario.CLIENTE,
    };

    await controller.findMeusPedidos(cliente);

    expect(pedidosService.findAll).toHaveBeenCalledWith(cliente);
  });
});

// Etapa 8.2 (HIGH-02 — exclusão de pedidos) — item G da etapa: prova que a
// correção não alterou autorização nenhuma. DELETE /pedidos/:id continua
// sob os mesmos guards de classe (JwtAuthGuard + RolesGuard) e a mesma
// whitelist de roles (@Roles(...STAFF_ROLES), herdada da classe — nenhum
// @Roles próprio no método, nem antes nem depois desta correção), e o
// controller continua só delegando id + @CurrentUser() para o service, sem
// nenhuma lógica de status/permissão movida para cá.
describe('PedidosController — remove (Etapa 8.2, autorização preservada)', () => {
  it('delega para PedidosService.remove com o id da URL e o usuário do @CurrentUser', async () => {
    const pedidosService = { remove: jest.fn().mockResolvedValue(undefined) };
    const controller = new PedidosController(
      pedidosService as unknown as PedidosService,
    );
    const admin: UsuarioAutenticado = {
      id: 1,
      email: 'admin@sensora.dev',
      perfil: PerfilUsuario.ADMIN,
    };

    await controller.remove(1, admin);

    expect(pedidosService.remove).toHaveBeenCalledWith(1, admin);
  });

  it('a rota está sob os mesmos guards de classe (JwtAuthGuard + RolesGuard), restrita a STAFF_ROLES — sem ampliar nem restringir', () => {
    const guards = Reflect.getMetadata('__guards__', PedidosController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);

    const roles = Reflect.getMetadata(ROLES_KEY, PedidosController) as unknown[];
    expect(roles).toEqual(STAFF_ROLES);
  });
});
