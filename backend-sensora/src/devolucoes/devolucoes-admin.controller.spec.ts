import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { DevolucoesAdminController } from './devolucoes-admin.controller';
import { DevolucoesService } from './devolucoes.service';
import { StatusDevolucao } from './enums/status-devolucao.enum';

// Rotas /admin/devolucoes pela camada HTTP de verdade (supertest), com o
// RolesGuard real e a MESMA ValidationPipe do main.ts. O JwtAuthGuard é
// trocado por um que lê o perfil do header "x-perfil" (simula o token).
const ADMIN_ID = 99;

describe('DevolucoesAdminController — /admin/devolucoes (HTTP)', () => {
  let app: INestApplication<App>;
  let service: {
    listarParaAdmin: jest.Mock;
    buscarParaAnalise: jest.Mock;
    aprovar: jest.Mock;
    recusar: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      listarParaAdmin: jest.fn().mockResolvedValue([]),
      buscarParaAnalise: jest.fn().mockResolvedValue({ id: 5 }),
      aprovar: jest.fn().mockResolvedValue({ id: 5, status: 'APROVADA' }),
      recusar: jest.fn().mockResolvedValue({ id: 5, status: 'RECUSADA' }),
    };

    const module = await Test.createTestingModule({
      controllers: [DevolucoesAdminController],
      providers: [{ provide: DevolucoesService, useValue: service }],
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
            req.user = { id: ADMIN_ID, email: 'x@sensora.dev', perfil };
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

  it('ADMIN lista a fila; ?status= é repassado', async () => {
    await http().get('/admin/devolucoes').set('x-perfil', 'ADMIN').expect(200);
    expect(service.listarParaAdmin).toHaveBeenLastCalledWith(undefined);

    await http()
      .get('/admin/devolucoes?status=SOLICITADA')
      .set('x-perfil', 'ADMIN')
      .expect(200);
    expect(service.listarParaAdmin).toHaveBeenLastCalledWith(
      StatusDevolucao.SOLICITADA,
    );
  });

  it('?status= fora dos status existentes: 400', async () => {
    await http()
      .get('/admin/devolucoes?status=XPTO')
      .set('x-perfil', 'ADMIN')
      .expect(400);
    expect(service.listarParaAdmin).not.toHaveBeenCalled();
  });

  it.each([
    ['VENDEDOR', 'VENDEDOR'],
    ['CLIENTE', 'CLIENTE'],
    ['sem usuário', undefined],
  ])('%s recebe 403 em todas as rotas', async (_caso, perfil) => {
    const comPerfil = (req: request.Test) =>
      perfil ? req.set('x-perfil', perfil) : req;

    await comPerfil(http().get('/admin/devolucoes')).expect(403);
    await comPerfil(http().get('/admin/devolucoes/5')).expect(403);
    await comPerfil(http().post('/admin/devolucoes/5/aprovar')).expect(403);
    await comPerfil(
      http().post('/admin/devolucoes/5/recusar').send({ observacao: 'Não' }),
    ).expect(403);

    for (const fn of Object.values(service)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('devolução inexistente: 404 do service chega ao cliente', async () => {
    service.buscarParaAnalise.mockRejectedValueOnce(
      new NotFoundException('Devolução não encontrada'),
    );

    await http()
      .get('/admin/devolucoes/999')
      .set('x-perfil', 'ADMIN')
      .expect(404);
  });

  it('aprovar: quem analisou vem do token, a observação é opcional', async () => {
    await http()
      .post('/admin/devolucoes/5/aprovar')
      .set('x-perfil', 'ADMIN')
      .send({ observacao: 'Pode enviar' })
      .expect(200);
    expect(service.aprovar).toHaveBeenLastCalledWith(
      5,
      ADMIN_ID,
      'Pode enviar',
    );

    await http()
      .post('/admin/devolucoes/5/aprovar')
      .set('x-perfil', 'ADMIN')
      .expect(200);
    expect(service.aprovar).toHaveBeenLastCalledWith(5, ADMIN_ID, undefined);
  });

  it.each([
    ['analisadoPorId', { analisadoPorId: 1 }],
    ['status', { status: 'CONCLUIDA' }],
    ['analisadaEm', { analisadaEm: '2020-01-01' }],
  ])('campo extra %s no corpo: 400, nada é decidido', async (_campo, extra) => {
    await http()
      .post('/admin/devolucoes/5/aprovar')
      .set('x-perfil', 'ADMIN')
      .send({ observacao: 'ok', ...extra })
      .expect(400);
    await http()
      .post('/admin/devolucoes/5/recusar')
      .set('x-perfil', 'ADMIN')
      .send({ observacao: 'Não', ...extra })
      .expect(400);
    expect(service.aprovar).not.toHaveBeenCalled();
    expect(service.recusar).not.toHaveBeenCalled();
  });

  it.each([
    ['sem observação', {}],
    ['observação vazia', { observacao: '' }],
    ['observação longa demais', { observacao: 'a'.repeat(1001) }],
  ])('recusar %s: 400', async (_caso, corpo) => {
    await http()
      .post('/admin/devolucoes/5/recusar')
      .set('x-perfil', 'ADMIN')
      .send(corpo)
      .expect(400);
    expect(service.recusar).not.toHaveBeenCalled();
  });

  it('recusar com observação: repassa id, admin do token e observação', async () => {
    await http()
      .post('/admin/devolucoes/5/recusar')
      .set('x-perfil', 'ADMIN')
      .send({ observacao: 'Produto usado' })
      .expect(200);
    expect(service.recusar).toHaveBeenCalledWith(5, ADMIN_ID, 'Produto usado');
  });
});
