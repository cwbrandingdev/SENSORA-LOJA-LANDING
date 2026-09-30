import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { DevolucoesController } from './devolucoes.controller';
import {
  DevolucoesService,
  TAMANHO_MAXIMO_EVIDENCIA,
} from './devolucoes.service';
import { CreateDevolucaoDto } from './dto/create-devolucao.dto';

function contextoCom(user: UsuarioAutenticado | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => DevolucoesController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('DevolucoesController — POST /pedidos/meus/:id/devolucoes', () => {
  const cliente: UsuarioAutenticado = {
    id: 7,
    email: 'cliente@sensora.dev',
    perfil: PerfilUsuario.CLIENTE,
  };

  it('delega para DevolucoesService.criar com o id da URL, o corpo e o usuário do token', async () => {
    const devolucaoRetornada = { id: 1 };
    const devolucoesService = {
      criar: jest.fn().mockResolvedValue(devolucaoRetornada),
    };
    const controller = new DevolucoesController(
      devolucoesService as unknown as DevolucoesService,
    );
    const corpo: CreateDevolucaoDto = {
      motivo: 'Chegou quebrada',
      itens: [{ itemPedidoId: 100, quantidade: 1 }],
    };

    const resultado = await controller.criar(10, corpo, cliente);

    expect(devolucoesService.criar).toHaveBeenCalledWith(10, corpo, cliente);
    expect(resultado).toBe(devolucaoRetornada);
  });

  it('GET meus/:id/devolucoes delega para listarDoPedido com o id da URL e o usuário do token', async () => {
    const historico = { devolucoes: [], itensDisponiveis: [] };
    const devolucoesService = {
      listarDoPedido: jest.fn().mockResolvedValue(historico),
    };
    const controller = new DevolucoesController(
      devolucoesService as unknown as DevolucoesService,
    );

    const resultado = await controller.listarDoPedido(10, cliente);

    expect(devolucoesService.listarDoPedido).toHaveBeenCalledWith(10, cliente);
    expect(resultado).toBe(historico);
  });

  it('exige autenticação (JwtAuthGuard + RolesGuard) e só o perfil CLIENTE', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      DevolucoesController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);

    expect(Reflect.getMetadata(ROLES_KEY, DevolucoesController)).toEqual([
      PerfilUsuario.CLIENTE,
    ]);
  });

  it('RolesGuard (real) libera CLIENTE e bloqueia ADMIN, VENDEDOR e requisição sem usuário', () => {
    const guard = new RolesGuard(new Reflector());

    expect(guard.canActivate(contextoCom(cliente))).toBe(true);
    for (const perfil of [PerfilUsuario.ADMIN, PerfilUsuario.VENDEDOR]) {
      expect(() =>
        guard.canActivate(contextoCom({ ...cliente, perfil })),
      ).toThrow(ForbiddenException);
    }
    expect(() => guard.canActivate(contextoCom(undefined))).toThrow(
      ForbiddenException,
    );
  });

  // Etapa 8 — a rota do documento herda o CLIENTE-only da classe (testado
  // acima); o dono é conferido no service (404 para outra pessoa).
  it('GET meus/:id/devolucoes/:devolucaoId/documento delega com os ids da URL e o usuário do token, sem cache', async () => {
    const devolucoesService = {
      documentoParaCliente: jest
        .fn()
        .mockResolvedValue({ url: 'https://melhorenvio.com.br/imprimir/x' }),
    };
    const controller = new DevolucoesController(
      devolucoesService as unknown as DevolucoesService,
    );

    await expect(controller.documento(10, 5, cliente)).resolves.toEqual({
      url: 'https://melhorenvio.com.br/imprimir/x',
    });
    expect(devolucoesService.documentoParaCliente).toHaveBeenCalledWith(
      10,
      5,
      cliente,
    );
    const { documento } = Object.getOwnPropertyDescriptors(
      DevolucoesController.prototype,
    );
    expect(
      Reflect.getMetadata('__headers__', documento.value as object),
    ).toEqual([{ name: 'Cache-Control', value: 'no-store' }]);
    // Sem @Roles próprio: herda o CLIENTE-only da classe.
    expect(
      Reflect.getMetadata(ROLES_KEY, documento.value as object),
    ).toBeUndefined();
  });
});

// Upload das evidências pela camada HTTP de verdade (FileInterceptor/multer
// reais, via supertest), com o service mockado: prova que o limite de 5 MB e
// "uma foto por requisição" valem no servidor, e que nada do multipart além
// do arquivo chega ao service (o cliente não escolhe pasta nem privacidade).
describe('DevolucoesController — POST /pedidos/meus/:id/devolucoes/:devolucaoId/evidencias (HTTP)', () => {
  const cliente: UsuarioAutenticado = {
    id: 7,
    email: 'cliente@sensora.dev',
    perfil: PerfilUsuario.CLIENTE,
  };
  const URL_UPLOAD = '/pedidos/meus/10/devolucoes/5/evidencias';
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

  let app: INestApplication<App>;
  let devolucoesService: { adicionarEvidencia: jest.Mock };

  beforeEach(async () => {
    devolucoesService = {
      adicionarEvidencia: jest.fn().mockResolvedValue({
        id: 1,
        url: 'https://ik.imagekit.io/sensora/x.jpg?ik-s=assinatura',
        criadoEm: '2026-09-30T10:00:00.000Z',
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [DevolucoesController],
      providers: [{ provide: DevolucoesService, useValue: devolucoesService }],
    })
      // Simula o JWT válido de um CLIENTE; o RolesGuard continua real.
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context
            .switchToHttp()
            .getRequest<{ user: UsuarioAutenticado }>().user = cliente;
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('foto válida no campo "foto": 201 e o service recebe o arquivo e o usuário do token', async () => {
    const resposta = await request(app.getHttpServer())
      .post(URL_UPLOAD)
      .attach('foto', JPEG, {
        filename: 'foto.jpg',
        contentType: 'image/jpeg',
      });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toEqual({
      id: 1,
      url: 'https://ik.imagekit.io/sensora/x.jpg?ik-s=assinatura',
      criadoEm: '2026-09-30T10:00:00.000Z',
    });
    const [pedidoId, devolucaoId, arquivo, user] = devolucoesService
      .adicionarEvidencia.mock.calls[0] as [
      number,
      number,
      { buffer: Buffer; size: number },
      UsuarioAutenticado,
    ];
    expect([pedidoId, devolucaoId]).toEqual([10, 5]);
    expect(arquivo.buffer.equals(JPEG)).toBe(true);
    expect(arquivo.size).toBe(JPEG.length);
    expect(user).toEqual(cliente);
  });

  it('arquivo acima de 5 MB: 413 no servidor, sem chegar ao service', async () => {
    const grande = Buffer.alloc(TAMANHO_MAXIMO_EVIDENCIA + 1, 0xff);

    const resposta = await request(app.getHttpServer())
      .post(URL_UPLOAD)
      .attach('foto', grande, 'grande.jpg');

    expect(resposta.status).toBe(413);
    expect(devolucoesService.adicionarEvidencia).not.toHaveBeenCalled();
  });

  it('mais de um arquivo na mesma requisição: 400, sem chegar ao service', async () => {
    const resposta = await request(app.getHttpServer())
      .post(URL_UPLOAD)
      .attach('foto', JPEG, 'a.jpg')
      .attach('foto', JPEG, 'b.jpg');

    expect(resposta.status).toBe(400);
    expect(devolucoesService.adicionarEvidencia).not.toHaveBeenCalled();
  });

  it('arquivo em outro campo: 400, sem chegar ao service', async () => {
    const resposta = await request(app.getHttpServer())
      .post(URL_UPLOAD)
      .attach('arquivo', JPEG, 'a.jpg');

    expect(resposta.status).toBe(400);
    expect(devolucoesService.adicionarEvidencia).not.toHaveBeenCalled();
  });

  it('pasta, nome e privacidade enviados pelo cliente são ignorados (só o arquivo chega ao service)', async () => {
    await request(app.getHttpServer())
      .post(URL_UPLOAD)
      .field('folder', '/publico')
      .field('isPrivateFile', 'false')
      .field('fileName', 'meu-nome.jpg')
      .attach('foto', JPEG, 'foto.jpg');

    const chamada = devolucoesService.adicionarEvidencia.mock
      .calls[0] as unknown[];
    expect(chamada).toHaveLength(4);
    expect(Object.keys(chamada[2] as object)).not.toEqual(
      expect.arrayContaining(['folder', 'isPrivateFile', 'fileName']),
    );
  });
});
