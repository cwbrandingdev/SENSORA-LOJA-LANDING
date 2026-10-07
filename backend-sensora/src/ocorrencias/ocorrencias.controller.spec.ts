import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { ListarOcorrenciasQueryDto } from './dto/listar-ocorrencias.dto';
import { OcorrenciasController } from './ocorrencias.controller';
import { OcorrenciasService } from './ocorrencias.service';

// Mesmo padrão de devolucoes-admin.controller.spec.ts: o JwtAuthGuard é
// substituído (perfil vem do header x-perfil) e o RolesGuard real decide.
describe('OcorrenciasController — GET /admin/ocorrencias (HTTP)', () => {
  let app: INestApplication<App>;
  let service: { listar: jest.Mock };

  beforeEach(async () => {
    service = {
      listar: jest.fn().mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [OcorrenciasController],
      providers: [{ provide: OcorrenciasService, useValue: service }],
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
            req.user = { id: 1, email: 'x@sensora.dev', perfil };
          }
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    // Mesma configuração do main.ts.
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
  const ultimaConsulta = (): ListarOcorrenciasQueryDto => {
    const chamadas = service.listar.mock.calls as [ListarOcorrenciasQueryDto][];
    return chamadas[chamadas.length - 1][0];
  };

  it('ADMIN consulta; sem parâmetros usa page=1 e pageSize=20', async () => {
    const resposta = await http()
      .get('/admin/ocorrencias')
      .set('x-perfil', 'ADMIN')
      .expect(200);

    expect(resposta.body).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    expect(ultimaConsulta()).toMatchObject({ page: 1, pageSize: 20 });
  });

  it.each(['VENDEDOR', 'CLIENTE'])('%s recebe 403', async (perfil) => {
    await http().get('/admin/ocorrencias').set('x-perfil', perfil).expect(403);
    expect(service.listar).not.toHaveBeenCalled();
  });

  it('filtros chegam ao service já convertidos', async () => {
    await http()
      .get(
        '/admin/ocorrencias?page=2&pageSize=50&tipo=REEMBOLSO&resultado=FALHA' +
          '&codigo=ASAAS_RECUSOU_ESTORNO&usuarioId=12&pedidoId=73&devolucaoId=5' +
          '&dataInicio=2026-10-01&dataFim=2026-10-06',
      )
      .set('x-perfil', 'ADMIN')
      .expect(200);

    expect(ultimaConsulta()).toMatchObject({
      page: 2,
      pageSize: 50,
      tipo: 'REEMBOLSO',
      resultado: 'FALHA',
      codigo: 'ASAAS_RECUSOU_ESTORNO',
      usuarioId: 12,
      pedidoId: 73,
      devolucaoId: 5,
      dataInicio: '2026-10-01',
      dataFim: '2026-10-06',
    });
  });

  it('pageSize=100 é aceito', async () => {
    await http()
      .get('/admin/ocorrencias?pageSize=100')
      .set('x-perfil', 'ADMIN')
      .expect(200);
  });

  it.each([
    ['page=0'],
    ['page=-1'],
    ['page=abc'],
    ['pageSize=0'],
    ['pageSize=101'],
    ['tipo=QUALQUER'],
    ['resultado=OK'],
    ['usuarioId=0'],
    ['pedidoId=abc'],
    ['dataInicio=ontem'],
    ['dataFim=2026-13-45'],
    ['ordenarPor=valor'],
  ])('parâmetro inválido (%s) é rejeitado com 400', async (query) => {
    await http()
      .get(`/admin/ocorrencias?${query}`)
      .set('x-perfil', 'ADMIN')
      .expect(400);
    expect(service.listar).not.toHaveBeenCalled();
  });
});
