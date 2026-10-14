import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CloudflareAwareThrottlerGuard } from '../auth/guards/render-throttler.guard';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { SuporteAdminController } from './suporte-admin.controller';
import {
  SuporteController,
  SUPORTE_RATE_LIMIT_MAX,
} from './suporte.controller';
import { SuporteService } from './suporte.service';

// Mesmo padrão de ocorrencias.controller.spec.ts: o JwtAuthGuard é
// substituído (perfil vem do header x-perfil; sem header não há usuário) e
// o RolesGuard real decide. ValidationPipe igual ao main.ts. O throttler é
// o mesmo guard global do app (CloudflareAwareThrottlerGuard), com um
// limite 'default' alto: só o @Throttle da rota de criação pode barrar.
describe('Suporte — controllers (HTTP)', () => {
  let app: INestApplication<App>;
  let service: {
    criar: jest.Mock;
    listarDoCliente: jest.Mock;
    listarParaAdmin: jest.Mock;
    buscarParaAdmin: jest.Mock;
    atualizarStatus: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      criar: jest.fn().mockResolvedValue({
        id: 1,
        assunto: 'Dúvida',
        status: 'ABERTA',
        criadaEm: new Date('2026-10-13T15:00:00Z'),
      }),
      listarDoCliente: jest
        .fn()
        .mockResolvedValue([
          { id: 1, assunto: 'Dúvida', status: 'EM_ATENDIMENTO' },
        ]),
      listarParaAdmin: jest.fn().mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
      buscarParaAdmin: jest.fn().mockResolvedValue({ id: 1 }),
      atualizarStatus: jest.fn().mockResolvedValue({ id: 1 }),
    };

    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', limit: 1000, ttl: 60_000 }],
        }),
      ],
      controllers: [SuporteController, SuporteAdminController],
      providers: [
        { provide: SuporteService, useValue: service },
        { provide: APP_GUARD, useClass: CloudflareAwareThrottlerGuard },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            user?: UsuarioAutenticado;
          }>();
          const perfil = req.headers['x-perfil'] as PerfilUsuario | undefined;
          if (perfil) {
            req.user = { id: 7, email: 'cliente@sensora.dev', perfil };
          }
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('POST /suporte (cliente)', () => {
    const corpo = {
      categoria: 'PEDIDO_ENTREGA',
      assunto: 'Dúvida',
      mensagem: 'Qual o prazo?',
    };
    const cat = { categoria: 'PEDIDO_ENTREGA' };

    it('exige JwtAuthGuard + RolesGuard e só o perfil CLIENTE', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        SuporteController,
      ) as unknown[];
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(ROLES_KEY, SuporteController)).toEqual([
        PerfilUsuario.CLIENTE,
      ]);
    });

    it('CLIENTE cria (201); o usuário vem do token, não do corpo', async () => {
      const resposta = await http()
        .post('/suporte')
        .set('x-perfil', 'CLIENTE')
        .send(corpo)
        .expect(201);

      expect(resposta.body).toMatchObject({ id: 1, status: 'ABERTA' });
      expect(service.criar).toHaveBeenCalledWith(corpo, {
        id: 7,
        email: 'cliente@sensora.dev',
        perfil: 'CLIENTE',
      });
    });

    it('sem usuário autenticado é recusado e nada é criado', async () => {
      await http().post('/suporte').send(corpo).expect(403);
      expect(service.criar).not.toHaveBeenCalled();
    });

    it.each(['ADMIN', 'VENDEDOR'])('%s recebe 403', async (perfil) => {
      await http()
        .post('/suporte')
        .set('x-perfil', perfil)
        .send(corpo)
        .expect(403);
      expect(service.criar).not.toHaveBeenCalled();
    });

    it.each([
      ['sem categoria', { assunto: 'Assunto', mensagem: 'Texto' }],
      ['categoria inexistente', { ...corpo, categoria: 'QUALQUER' }],
      ['categoria vazia', { ...corpo, categoria: '' }],
      ['sem assunto', { ...cat, mensagem: 'Texto' }],
      ['sem mensagem', { ...cat, assunto: 'Assunto' }],
      ['assunto vazio', { ...cat, assunto: '', mensagem: 'Texto' }],
      ['mensagem vazia', { ...cat, assunto: 'Assunto', mensagem: '' }],
      [
        'assunto com 151 caracteres',
        { ...cat, assunto: 'a'.repeat(151), mensagem: 'Texto' },
      ],
      [
        'mensagem com 5001 caracteres',
        { ...cat, assunto: 'Assunto', mensagem: 'a'.repeat(5001) },
      ],
      ['assunto não-texto', { ...cat, assunto: 123, mensagem: 'Texto' }],
      ['e-mail no corpo', { ...corpo, email: 'outro@sensora.dev' }],
      ['usuarioId no corpo', { ...corpo, usuarioId: 99 }],
      ['nome no corpo', { ...corpo, nome: 'Outra Pessoa' }],
      ['status no corpo', { ...corpo, status: 'RESOLVIDA' }],
    ])('%s: 400, nada criado', async (_caso, invalido) => {
      await http()
        .post('/suporte')
        .set('x-perfil', 'CLIENTE')
        .send(invalido)
        .expect(400);
      expect(service.criar).not.toHaveBeenCalled();
    });

    it('limites exatos (150 / 5000 caracteres) são aceitos', async () => {
      await http()
        .post('/suporte')
        .set('x-perfil', 'CLIENTE')
        .send({ ...cat, assunto: 'a'.repeat(150), mensagem: 'b'.repeat(5000) })
        .expect(201);
    });

    it(`rate limit próprio: a ${SUPORTE_RATE_LIMIT_MAX + 1}ª abertura na janela recebe 429`, async () => {
      for (let i = 0; i < SUPORTE_RATE_LIMIT_MAX; i++) {
        await http()
          .post('/suporte')
          .set('x-perfil', 'CLIENTE')
          .send({ ...corpo, mensagem: `Mensagem ${i}` })
          .expect(201);
      }

      await http()
        .post('/suporte')
        .set('x-perfil', 'CLIENTE')
        .send(corpo)
        .expect(429);
      expect(service.criar).toHaveBeenCalledTimes(SUPORTE_RATE_LIMIT_MAX);
    });

    it('o limite próprio vale só para a criação: a listagem do admin continua livre', async () => {
      for (let i = 0; i < SUPORTE_RATE_LIMIT_MAX + 2; i++) {
        await http().get('/admin/suporte').set('x-perfil', 'ADMIN').expect(200);
      }
    });
  });

  describe('GET /suporte (cliente)', () => {
    it('CLIENTE lista os próprios chamados (usuário do token)', async () => {
      const resposta = await http()
        .get('/suporte')
        .set('x-perfil', 'CLIENTE')
        .expect(200);

      expect(resposta.body).toEqual([
        { id: 1, assunto: 'Dúvida', status: 'EM_ATENDIMENTO' },
      ]);
      expect(service.listarDoCliente).toHaveBeenCalledWith(7);
    });

    it('sem usuário ou com perfil ADMIN é recusado e nada é listado', async () => {
      await http().get('/suporte').expect(403);
      await http().get('/suporte').set('x-perfil', 'ADMIN').expect(403);
      expect(service.listarDoCliente).not.toHaveBeenCalled();
    });
  });

  describe('/admin/suporte (ADMIN)', () => {
    it('exige JwtAuthGuard + RolesGuard e ADMIN_ONLY_ROLES', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        SuporteAdminController,
      ) as unknown[];
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
      expect(Reflect.getMetadata(ROLES_KEY, SuporteAdminController)).toEqual(
        ADMIN_ONLY_ROLES,
      );
    });

    it('ADMIN lista; sem parâmetros usa page=1 e pageSize=20', async () => {
      await http().get('/admin/suporte').set('x-perfil', 'ADMIN').expect(200);
      expect(service.listarParaAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 }),
      );
    });

    it('filtro e paginação chegam ao service já convertidos', async () => {
      await http()
        .get(
          '/admin/suporte?page=2&pageSize=50&status=EM_ATENDIMENTO&categoria=PAGAMENTO',
        )
        .set('x-perfil', 'ADMIN')
        .expect(200);
      expect(service.listarParaAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 50,
          status: 'EM_ATENDIMENTO',
          categoria: 'PAGAMENTO',
        }),
      );
    });

    it.each([
      'page=0',
      'pageSize=101',
      'status=QUALQUER',
      'categoria=QUALQUER',
      'ordenarPor=email',
    ])('parâmetro inválido (%s) é 400', async (query) => {
      await http()
        .get(`/admin/suporte?${query}`)
        .set('x-perfil', 'ADMIN')
        .expect(400);
      expect(service.listarParaAdmin).not.toHaveBeenCalled();
    });

    it('ADMIN abre o detalhe e muda o status', async () => {
      await http().get('/admin/suporte/5').set('x-perfil', 'ADMIN').expect(200);
      expect(service.buscarParaAdmin).toHaveBeenCalledWith(5);

      await http()
        .patch('/admin/suporte/5/status')
        .set('x-perfil', 'ADMIN')
        .send({ status: 'RESOLVIDA' })
        .expect(200);
      expect(service.atualizarStatus).toHaveBeenCalledWith(5, {
        status: 'RESOLVIDA',
      });
    });

    it.each([
      [{ status: 'ABERTA' }],
      [{ status: 'QUALQUER' }],
      [{}],
      [{ status: 'RESOLVIDA', assunto: 'trocado' }],
    ])('status inválido (%j) é 400, nada alterado', async (corpo) => {
      await http()
        .patch('/admin/suporte/5/status')
        .set('x-perfil', 'ADMIN')
        .send(corpo)
        .expect(400);
      expect(service.atualizarStatus).not.toHaveBeenCalled();
    });

    it('id não numérico é 400', async () => {
      await http()
        .get('/admin/suporte/abc')
        .set('x-perfil', 'ADMIN')
        .expect(400);
      expect(service.buscarParaAdmin).not.toHaveBeenCalled();
    });

    it.each(['VENDEDOR', 'CLIENTE'])(
      '%s recebe 403 em listar, detalhe e mudança de status',
      async (perfil) => {
        await http().get('/admin/suporte').set('x-perfil', perfil).expect(403);
        await http()
          .get('/admin/suporte/5')
          .set('x-perfil', perfil)
          .expect(403);
        await http()
          .patch('/admin/suporte/5/status')
          .set('x-perfil', perfil)
          .send({ status: 'RESOLVIDA' })
          .expect(403);
        expect(service.listarParaAdmin).not.toHaveBeenCalled();
        expect(service.buscarParaAdmin).not.toHaveBeenCalled();
        expect(service.atualizarStatus).not.toHaveBeenCalled();
      },
    );

    it('sem usuário autenticado é recusado', async () => {
      await http().get('/admin/suporte').expect(403);
      expect(service.listarParaAdmin).not.toHaveBeenCalled();
    });
  });
});
