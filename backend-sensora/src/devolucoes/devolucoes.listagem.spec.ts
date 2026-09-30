import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ImagekitService } from '../imagekit/imagekit.service';
import { MailService } from '../mail/mail.service';
import { MelhorEnvioService } from '../melhor-envio/melhor-envio.service';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { DevolucoesService } from './devolucoes.service';
import { StatusDevolucao } from './enums/status-devolucao.enum';

// Histórico de devoluções do pedido (GET /pedidos/meus/:id/devolucoes) —
// Prisma e ImageKit MOCKADOS, "banco" em memória com pedidos de dois
// clientes, devoluções em vários status e fotos.

const CLIENTE: UsuarioAutenticado = {
  id: 1,
  email: 'cliente@sensora.dev',
  perfil: PerfilUsuario.CLIENTE,
};
const OUTRO_CLIENTE: UsuarioAutenticado = {
  id: 2,
  email: 'outro@sensora.dev',
  perfil: PerfilUsuario.CLIENTE,
};

type DevolucaoFake = {
  id: number;
  pedidoId: number;
  usuarioId: number;
  status: StatusDevolucao;
  solicitadaEm: Date;
  analisadaEm: Date | null;
  observacaoAnalise: string | null;
  analisadoPorId: number | null;
  itens: { itemPedidoId: number; quantidade: number }[];
  evidencias: { id: number; fileId: string; caminho: string; criadoEm: Date }[];
};

// Pedido 10 (do CLIENTE): item 100 comprado 3x, item 200 comprado 2x.
// Pedido 20 (do CLIENTE) e pedido 30 (do OUTRO_CLIENTE) só para conferir
// que nada de outros pedidos vaza.
const PEDIDOS = [
  {
    id: 10,
    usuarioId: CLIENTE.id,
    itens: [
      { id: 100, quantidade: 3 },
      { id: 200, quantidade: 2 },
    ],
  },
  { id: 20, usuarioId: CLIENTE.id, itens: [{ id: 300, quantidade: 1 }] },
  { id: 30, usuarioId: OUTRO_CLIENTE.id, itens: [{ id: 400, quantidade: 1 }] },
];

const STATUS_QUE_CONSOMEM = [
  StatusDevolucao.SOLICITADA,
  StatusDevolucao.EM_ANALISE,
  StatusDevolucao.APROVADA,
  StatusDevolucao.AGUARDANDO_ENVIO,
  StatusDevolucao.ENVIADA,
  StatusDevolucao.RECEBIDA,
  StatusDevolucao.EM_CONFERENCIA,
  StatusDevolucao.CONCLUIDA,
];

describe('DevolucoesService — listarDoPedido (Etapa 6)', () => {
  let service: DevolucoesService;
  let devolucoesFake: DevolucaoFake[];
  let prisma: {
    pedido: { findUnique: jest.Mock };
    devolucao: { findMany: jest.Mock };
    itemDevolucao: { findMany: jest.Mock };
  };
  let imagekit: { gerarUrlAssinada: jest.Mock };

  function devolucao(
    id: number,
    status: StatusDevolucao,
    itens: { itemPedidoId: number; quantidade: number }[],
    extras: Partial<DevolucaoFake> = {},
  ): DevolucaoFake {
    const nova: DevolucaoFake = {
      id,
      pedidoId: 10,
      usuarioId: CLIENTE.id,
      status,
      solicitadaEm: new Date(`2026-09-${10 + id}T12:00:00Z`),
      analisadaEm: null,
      observacaoAnalise: null,
      analisadoPorId: null,
      itens,
      evidencias: [],
      ...extras,
    };
    devolucoesFake.push(nova);
    return nova;
  }

  beforeEach(async () => {
    devolucoesFake = [];

    prisma = {
      pedido: {
        findUnique: jest.fn(
          ({ where }: { where: { id: number } }) =>
            PEDIDOS.find((pedido) => pedido.id === where.id) ?? null,
        ),
      },
      devolucao: {
        // Aplica o filtro e a ordenação pedidos pelo service, como o banco.
        findMany: jest.fn(
          ({ where }: { where: { pedidoId: number; usuarioId: number } }) =>
            devolucoesFake
              .filter(
                (d) =>
                  d.pedidoId === where.pedidoId &&
                  d.usuarioId === where.usuarioId,
              )
              .sort(
                (a, b) =>
                  b.solicitadaEm.getTime() - a.solicitadaEm.getTime() ||
                  b.id - a.id,
              )
              .map((d) => ({
                ...d,
                motivo: 'Chegou quebrada',
                descricao: null,
                atualizadoEm: d.solicitadaEm,
                itens: d.itens.map((item, i) => ({
                  id: d.id * 10 + i,
                  devolucaoId: d.id,
                  precoUnitario: 50,
                  ...item,
                })),
              })),
        ),
      },
      itemDevolucao: {
        findMany: jest.fn(
          ({
            where,
          }: {
            where: {
              itemPedidoId: { in: number[] };
              devolucao: { status: { notIn: StatusDevolucao[] } };
            };
          }) =>
            devolucoesFake
              .filter((d) => !where.devolucao.status.notIn.includes(d.status))
              .flatMap((d) => d.itens)
              .filter((item) =>
                where.itemPedidoId.in.includes(item.itemPedidoId),
              ),
        ),
      },
    };

    imagekit = {
      gerarUrlAssinada: jest.fn(
        (caminho: string, segundos: number) =>
          `https://ik.imagekit.io/sensora${caminho}?ik-t=${segundos}&ik-s=assinatura`,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevolucoesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ImagekitService, useValue: imagekit },
        { provide: MailService, useValue: {} },
        { provide: MelhorEnvioService, useValue: {} },
      ],
    }).compile();

    service = module.get(DevolucoesService);
  });

  function saldo(
    resultado: Awaited<ReturnType<DevolucoesService['listarDoPedido']>>,
    itemPedidoId: number,
  ) {
    return resultado.itensDisponiveis.find(
      (item) => item.itemPedidoId === itemPedidoId,
    )?.quantidadeDisponivel;
  }

  it('dono consulta o próprio pedido: sem devoluções, saldo = quantidade comprada', async () => {
    const resultado = await service.listarDoPedido(10, CLIENTE);

    expect(resultado).toEqual({
      devolucoes: [],
      itensDisponiveis: [
        { itemPedidoId: 100, quantidadeDisponivel: 3 },
        { itemPedidoId: 200, quantidadeDisponivel: 2 },
      ],
    });
  });

  it.each([
    ['pedido de outro usuário', 30],
    ['pedido inexistente', 999],
  ])(
    '%s: 404 no padrão existente, sem buscar devoluções nem gerar URL',
    async (_caso, pedidoId) => {
      devolucao(
        1,
        StatusDevolucao.SOLICITADA,
        [{ itemPedidoId: 100, quantidade: 1 }],
        {
          evidencias: [
            { id: 1, fileId: 'f', caminho: '/x.jpg', criadoEm: new Date() },
          ],
        },
      );

      await expect(service.listarDoPedido(pedidoId, CLIENTE)).rejects.toThrow(
        new NotFoundException(`Pedido com id ${pedidoId} não encontrado`),
      );
      expect(prisma.devolucao.findMany).not.toHaveBeenCalled();
      expect(imagekit.gerarUrlAssinada).not.toHaveBeenCalled();
    },
  );

  it('outro cliente tentando o pedido do CLIENTE: 404', async () => {
    await expect(service.listarDoPedido(10, OUTRO_CLIENTE)).rejects.toThrow(
      NotFoundException,
    );
    expect(imagekit.gerarUrlAssinada).not.toHaveBeenCalled();
  });

  it('várias devoluções, mais recentes primeiro, filtrando por pedido e usuário', async () => {
    devolucao(1, StatusDevolucao.RECUSADA, [
      { itemPedidoId: 100, quantidade: 1 },
    ]);
    devolucao(3, StatusDevolucao.SOLICITADA, [
      { itemPedidoId: 200, quantidade: 1 },
    ]);
    devolucao(2, StatusDevolucao.EM_ANALISE, [
      { itemPedidoId: 100, quantidade: 1 },
    ]);

    const resultado = await service.listarDoPedido(10, CLIENTE);

    expect(resultado.devolucoes.map((d) => d.id)).toEqual([3, 2, 1]);
    expect(prisma.devolucao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pedidoId: 10, usuarioId: CLIENTE.id },
        orderBy: [{ solicitadaEm: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('devoluções de outros pedidos não aparecem', async () => {
    devolucao(1, StatusDevolucao.SOLICITADA, [
      { itemPedidoId: 100, quantidade: 1 },
    ]);
    devolucao(
      2,
      StatusDevolucao.SOLICITADA,
      [{ itemPedidoId: 300, quantidade: 1 }],
      {
        pedidoId: 20,
      },
    );

    const resultado = await service.listarDoPedido(10, CLIENTE);

    expect(resultado.devolucoes.map((d) => d.id)).toEqual([1]);
  });

  it('saldo: comprou 3 e já pediu 2 → sobra 1; item sem devolução mantém o comprado', async () => {
    devolucao(1, StatusDevolucao.SOLICITADA, [
      { itemPedidoId: 100, quantidade: 2 },
    ]);

    const resultado = await service.listarDoPedido(10, CLIENTE);

    expect(saldo(resultado, 100)).toBe(1);
    expect(saldo(resultado, 200)).toBe(2);
  });

  it('saldo: várias devoluções que consomem somam (1 + 2 de 3 → 0)', async () => {
    devolucao(1, StatusDevolucao.SOLICITADA, [
      { itemPedidoId: 100, quantidade: 1 },
    ]);
    devolucao(2, StatusDevolucao.APROVADA, [
      { itemPedidoId: 100, quantidade: 2 },
      { itemPedidoId: 200, quantidade: 1 },
    ]);

    const resultado = await service.listarDoPedido(10, CLIENTE);

    expect(saldo(resultado, 100)).toBe(0);
    expect(saldo(resultado, 200)).toBe(1);
  });

  it.each([StatusDevolucao.RECUSADA, StatusDevolucao.CANCELADA])(
    '%s libera o saldo',
    async (status) => {
      devolucao(1, status, [{ itemPedidoId: 100, quantidade: 3 }]);

      const resultado = await service.listarDoPedido(10, CLIENTE);

      expect(saldo(resultado, 100)).toBe(3);
      // A devolução continua aparecendo no histórico.
      expect(resultado.devolucoes.map((d) => d.status)).toEqual([status]);
    },
  );

  it.each(STATUS_QUE_CONSOMEM)('%s consome o saldo', async (status) => {
    devolucao(1, status, [{ itemPedidoId: 100, quantidade: 2 }]);

    const resultado = await service.listarDoPedido(10, CLIENTE);

    expect(saldo(resultado, 100)).toBe(1);
  });

  it('evidências vêm com URL assinada de 600 s, sem fileId, caminho nem dados internos da análise', async () => {
    devolucao(
      1,
      StatusDevolucao.RECUSADA,
      [{ itemPedidoId: 100, quantidade: 1 }],
      {
        analisadaEm: new Date('2026-09-20T15:00:00Z'),
        observacaoAnalise: 'Nota interna da loja',
        analisadoPorId: 99,
        evidencias: [
          {
            id: 7,
            fileId: 'file_secreto',
            caminho: '/sensora/devolucoes/1/foto.jpg',
            criadoEm: new Date('2026-09-11T13:00:00Z'),
          },
        ],
      },
    );

    const resultado = await service.listarDoPedido(10, CLIENTE);
    const [dev] = resultado.devolucoes;

    expect(dev.analisadaEm).toEqual(new Date('2026-09-20T15:00:00Z'));
    expect(dev.evidencias).toEqual([
      {
        id: 7,
        url: 'https://ik.imagekit.io/sensora/sensora/devolucoes/1/foto.jpg?ik-t=600&ik-s=assinatura',
        criadoEm: new Date('2026-09-11T13:00:00Z'),
      },
    ]);
    expect(imagekit.gerarUrlAssinada).toHaveBeenCalledWith(
      '/sensora/devolucoes/1/foto.jpg',
      600,
    );

    const json = JSON.stringify(resultado);
    for (const interno of [
      'fileId',
      'file_secreto',
      'caminho',
      'observacaoAnalise',
      'Nota interna da loja',
      'analisadoPorId',
      'usuarioId',
    ]) {
      expect(json).not.toContain(interno);
    }
  });
});
