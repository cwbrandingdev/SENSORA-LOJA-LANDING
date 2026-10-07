import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AsaasService } from '../asaas/asaas.service';
import { OcorrenciasService } from '../ocorrencias/ocorrencias.service';
import { ImagekitService } from '../imagekit/imagekit.service';
import { MailService } from '../mail/mail.service';
import { MelhorEnvioService } from '../melhor-envio/melhor-envio.service';
import { StatusEnvio } from '../pedidos/enums/status-envio.enum';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../produtos/produtos.service';
import { DevolucoesService } from './devolucoes.service';
import { StatusDevolucao } from './enums/status-devolucao.enum';

// Etapa 7 — análise das devoluções pelo ADMIN. Prisma, ImageKit e e-mail
// MOCKADOS ("banco" em memória). O updateMany simula o banco: só aplica a
// mudança se o WHERE (status da devolução + pedido PAGO/ENVIADO) ainda bater
// no instante da escrita. AsaasService e ProdutosService estão registrados
// só para provar que nunca são chamados (nada de reembolso nem estoque).

const ADMIN_ID = 99;

type PedidoFake = {
  id: number;
  numero: string;
  data: Date;
  status: StatusPedido;
  statusEnvio: StatusEnvio;
  enviadoEm: Date | null;
  total: number;
  clienteNome: string | null;
  clienteEmail: string | null;
};

type DevolucaoFake = {
  id: number;
  pedidoId: number;
  usuarioId: number | null;
  status: StatusDevolucao;
  motivo: string;
  descricao: string | null;
  solicitadaEm: Date;
  analisadaEm: Date | null;
  observacaoAnalise: string | null;
  analisadoPorId: number | null;
  itens: {
    id: number;
    itemPedidoId: number;
    quantidade: number;
    precoUnitario: number;
    quantidadeComprada: number;
    produtoNome: string;
  }[];
  evidencias: { id: number; fileId: string; caminho: string; criadoEm: Date }[];
};

describe('DevolucoesService — análise pelo ADMIN (Etapa 7)', () => {
  let service: DevolucoesService;
  let pedido: PedidoFake;
  let devolucoes: DevolucaoFake[];
  let usuarios: Map<number, { nome: string; email: string }>;
  let updateMany: jest.Mock;
  let mail: { enviarEmail: jest.Mock };
  let imagekit: { gerarUrlAssinada: jest.Mock };
  let asaas: Record<string, jest.Mock>;
  let produtos: Record<string, jest.Mock>;

  // Objeto completo que o "banco" devolve (o service só lê o que incluiu).
  function comRelacoes(d: DevolucaoFake) {
    const usuario = d.usuarioId !== null ? usuarios.get(d.usuarioId) : null;
    const analisadoPor =
      d.analisadoPorId !== null ? usuarios.get(d.analisadoPorId) : null;
    return {
      ...d,
      pedido: { ...pedido },
      usuario: usuario ?? null,
      analisadoPor: analisadoPor ? { nome: analisadoPor.nome } : null,
      itens: d.itens.map((item) => ({
        id: item.id,
        devolucaoId: d.id,
        itemPedidoId: item.itemPedidoId,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        itemPedido: {
          quantidade: item.quantidadeComprada,
          produto: { nome: item.produtoNome },
        },
      })),
      _count: { evidencias: d.evidencias.length },
    };
  }

  function novaDevolucao(extras: Partial<DevolucaoFake> = {}): DevolucaoFake {
    const devolucao: DevolucaoFake = {
      id: devolucoes.length + 1,
      pedidoId: pedido.id,
      usuarioId: 1,
      status: StatusDevolucao.SOLICITADA,
      motivo: 'Chegou quebrada',
      descricao: 'Tampa rachada',
      solicitadaEm: new Date('2026-09-25T12:00:00Z'),
      analisadaEm: null,
      observacaoAnalise: null,
      analisadoPorId: null,
      itens: [
        {
          id: 1,
          itemPedidoId: 100,
          quantidade: 2,
          precoUnitario: 59.9,
          quantidadeComprada: 3,
          produtoNome: 'Vela Lavanda',
        },
      ],
      evidencias: [
        {
          id: 7,
          fileId: 'file_secreto',
          caminho: '/sensora/devolucoes/1/foto.jpg',
          criadoEm: new Date('2026-09-25T12:05:00Z'),
        },
      ],
      ...extras,
    };
    devolucoes.push(devolucao);
    return devolucao;
  }

  beforeEach(async () => {
    pedido = {
      id: 10,
      numero: 'PED-10',
      data: new Date('2026-09-10T00:00:00Z'),
      status: StatusPedido.PAGO,
      statusEnvio: StatusEnvio.ENVIADO,
      enviadoEm: new Date('2026-09-12T10:00:00Z'),
      total: 179.7,
      clienteNome: 'Nome no pedido',
      clienteEmail: 'pedido@sensora.dev',
    };
    devolucoes = [];
    usuarios = new Map([
      [1, { nome: 'Cliente', email: 'cliente@sensora.dev' }],
      [ADMIN_ID, { nome: 'Admin Sensora', email: 'admin@sensora.dev' }],
    ]);

    updateMany = jest.fn(
      ({
        where,
        data,
      }: {
        where: {
          id: number;
          status: { in: StatusDevolucao[] };
          pedido: { status: StatusPedido; statusEnvio: StatusEnvio };
        };
        data: Partial<DevolucaoFake>;
      }) => {
        const d = devolucoes.find((x) => x.id === where.id);
        const bate =
          d &&
          where.status.in.includes(d.status) &&
          pedido.status === where.pedido.status &&
          pedido.statusEnvio === where.pedido.statusEnvio;
        if (!bate) {
          return { count: 0 };
        }
        Object.assign(d, data);
        return { count: 1 };
      },
    );

    const prisma = {
      devolucao: {
        findUnique: jest.fn(({ where }: { where: { id: number } }) => {
          const d = devolucoes.find((x) => x.id === where.id);
          return d ? comRelacoes(d) : null;
        }),
        findMany: jest.fn(
          ({ where }: { where: { status?: StatusDevolucao } }) =>
            devolucoes
              .filter((d) => !where.status || d.status === where.status)
              .sort(
                (a, b) => b.solicitadaEm.getTime() - a.solicitadaEm.getTime(),
              )
              .map(comRelacoes),
        ),
        updateMany,
      },
    };

    mail = { enviarEmail: jest.fn().mockResolvedValue(undefined) };
    imagekit = {
      gerarUrlAssinada: jest.fn(
        (caminho: string, segundos: number) =>
          `https://ik.imagekit.io/sensora${caminho}?ik-t=${segundos}&ik-s=assinatura`,
      ),
    };
    asaas = {
      estornarPagamento: jest.fn(),
      consultarEstornos: jest.fn(),
    };
    produtos = { adicionarEstoque: jest.fn(), removerEstoque: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevolucoesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ImagekitService, useValue: imagekit },
        { provide: MailService, useValue: mail },
        { provide: MelhorEnvioService, useValue: {} },
        { provide: AsaasService, useValue: asaas },
        { provide: OcorrenciasService, useValue: { registrar: jest.fn() } },
        { provide: ProdutosService, useValue: produtos },
      ],
    }).compile();

    service = module.get(DevolucoesService);
  });

  afterEach(() => {
    // Nenhuma etapa desta análise pode tocar em reembolso ou estoque.
    for (const fn of [...Object.values(asaas), ...Object.values(produtos)]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  describe('listarParaAdmin', () => {
    it('fila: mais recentes primeiro, com cliente, quantidades e sem gerar URL de foto', async () => {
      novaDevolucao({ solicitadaEm: new Date('2026-09-20T12:00:00Z') });
      novaDevolucao({
        solicitadaEm: new Date('2026-09-26T12:00:00Z'),
        status: StatusDevolucao.RECUSADA,
      });

      const fila = await service.listarParaAdmin();

      expect(fila.map((d) => d.id)).toEqual([2, 1]);
      expect(fila[1]).toEqual({
        id: 1,
        pedidoId: 10,
        pedidoNumero: 'PED-10',
        clienteNome: 'Cliente',
        clienteEmail: 'cliente@sensora.dev',
        status: StatusDevolucao.SOLICITADA,
        solicitadaEm: new Date('2026-09-20T12:00:00Z'),
        analisadaEm: null,
        quantidadeItens: 2,
        quantidadeFotos: 1,
      });
      expect(imagekit.gerarUrlAssinada).not.toHaveBeenCalled();
      expect(JSON.stringify(fila)).not.toMatch(/fileId|caminho|file_secreto/);
    });

    it('filtro por status', async () => {
      novaDevolucao();
      novaDevolucao({ status: StatusDevolucao.APROVADA });

      const fila = await service.listarParaAdmin(StatusDevolucao.APROVADA);

      expect(fila.map((d) => d.status)).toEqual([StatusDevolucao.APROVADA]);
    });

    it('cliente excluído: usa nome/e-mail gravados no pedido', async () => {
      novaDevolucao({ usuarioId: null });

      const [item] = await service.listarParaAdmin();

      expect(item.clienteNome).toBe('Nome no pedido');
      expect(item.clienteEmail).toBe('pedido@sensora.dev');
    });
  });

  describe('buscarParaAnalise', () => {
    it('detalhe com pedido, cliente, itens e fotos em URL assinada de 600 s, sem fileId/caminho', async () => {
      novaDevolucao();

      const analise = await service.buscarParaAnalise(1);

      expect(analise.pedido).toEqual({
        id: 10,
        numero: 'PED-10',
        data: pedido.data,
        status: StatusPedido.PAGO,
        statusEnvio: StatusEnvio.ENVIADO,
        enviadoEm: pedido.enviadoEm,
        total: 179.7,
      });
      expect(analise.cliente).toEqual({
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
      });
      expect(analise.itens).toEqual([
        {
          id: 1,
          itemPedidoId: 100,
          produtoNome: 'Vela Lavanda',
          quantidade: 2,
          quantidadeComprada: 3,
          precoUnitario: 59.9,
        },
      ]);
      expect(analise.evidencias).toEqual([
        {
          id: 7,
          url: 'https://ik.imagekit.io/sensora/sensora/devolucoes/1/foto.jpg?ik-t=600&ik-s=assinatura',
          criadoEm: new Date('2026-09-25T12:05:00Z'),
        },
      ]);
      expect(JSON.stringify(analise)).not.toMatch(
        /fileId|caminho|file_secreto/,
      );
    });

    it('devolução inexistente: 404', async () => {
      await expect(service.buscarParaAnalise(999)).rejects.toThrow(
        new NotFoundException('Devolução não encontrada'),
      );
    });
  });

  describe('aprovar', () => {
    it.each([StatusDevolucao.SOLICITADA, StatusDevolucao.EM_ANALISE])(
      'aprova a partir de %s, gravando data, quem analisou e a observação',
      async (status) => {
        novaDevolucao({ status });

        const resultado = await service.aprovar(1, ADMIN_ID, '  Pode enviar  ');

        expect(resultado.status).toBe(StatusDevolucao.APROVADA);
        expect(resultado.analisadoPorNome).toBe('Admin Sensora');
        expect(resultado.observacaoAnalise).toBe('Pode enviar');
        expect(devolucoes[0].analisadoPorId).toBe(ADMIN_ID);
        expect(devolucoes[0].analisadaEm).toBeInstanceOf(Date);
      },
    );

    it('aprova sem observação (fica null)', async () => {
      novaDevolucao();

      const resultado = await service.aprovar(1, ADMIN_ID);

      expect(resultado.status).toBe(StatusDevolucao.APROVADA);
      expect(devolucoes[0].observacaoAnalise).toBeNull();
    });

    it('atualização atômica condicionada ao status e ao pedido PAGO + ENVIADO', async () => {
      novaDevolucao();

      await service.aprovar(1, ADMIN_ID);

      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: 1,
          status: {
            in: [StatusDevolucao.SOLICITADA, StatusDevolucao.EM_ANALISE],
          },
          pedido: {
            status: StatusPedido.PAGO,
            statusEnvio: StatusEnvio.ENVIADO,
          },
        },
        data: {
          status: StatusDevolucao.APROVADA,
          analisadaEm: expect.any(Date) as Date,
          analisadoPorId: ADMIN_ID,
          observacaoAnalise: null,
        },
      });
    });
  });

  describe('recusar', () => {
    it.each([
      ['sem observação', undefined],
      ['observação vazia', ''],
      ['só espaços', '    '],
    ])('%s: 400, nada muda e nenhum e-mail', async (_caso, observacao) => {
      novaDevolucao();

      await expect(
        service.recusar(1, ADMIN_ID, observacao as unknown as string),
      ).rejects.toThrow(new BadRequestException('Informe o motivo da recusa.'));
      expect(devolucoes[0].status).toBe(StatusDevolucao.SOLICITADA);
      expect(updateMany).not.toHaveBeenCalled();
      expect(mail.enviarEmail).not.toHaveBeenCalled();
    });

    it('recusa com observação (sem espaços extras)', async () => {
      novaDevolucao();

      const resultado = await service.recusar(1, ADMIN_ID, '  Produto usado  ');

      expect(resultado.status).toBe(StatusDevolucao.RECUSADA);
      expect(resultado.observacaoAnalise).toBe('Produto usado');
      expect(devolucoes[0].analisadoPorId).toBe(ADMIN_ID);
    });
  });

  describe('transições e pedido', () => {
    it.each([
      StatusDevolucao.APROVADA,
      StatusDevolucao.RECUSADA,
      StatusDevolucao.AGUARDANDO_ENVIO,
      StatusDevolucao.ENVIADA,
      StatusDevolucao.RECEBIDA,
      StatusDevolucao.EM_CONFERENCIA,
      StatusDevolucao.CONCLUIDA,
      StatusDevolucao.CANCELADA,
    ])(
      'devolução %s: aprovar e recusar dão 409, sem e-mail',
      async (status) => {
        novaDevolucao({ status });

        await expect(service.aprovar(1, ADMIN_ID)).rejects.toThrow(
          ConflictException,
        );
        await expect(service.recusar(1, ADMIN_ID, 'Não')).rejects.toThrow(
          ConflictException,
        );
        expect(devolucoes[0].status).toBe(status);
        expect(mail.enviarEmail).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['REEMBOLSADO', StatusPedido.REEMBOLSADO, StatusEnvio.ENVIADO],
      [
        'REEMBOLSO_SOLICITADO',
        StatusPedido.REEMBOLSO_SOLICITADO,
        StatusEnvio.ENVIADO,
      ],
      ['PAGO mas NAO_ENVIADO', StatusPedido.PAGO, StatusEnvio.NAO_ENVIADO],
    ])(
      'pedido %s: 409 e a devolução continua SOLICITADA',
      async (_caso, status, statusEnvio) => {
        novaDevolucao();
        pedido.status = status;
        pedido.statusEnvio = statusEnvio;

        await expect(service.aprovar(1, ADMIN_ID)).rejects.toThrow(
          /não está mais pago e enviado/,
        );
        expect(devolucoes[0].status).toBe(StatusDevolucao.SOLICITADA);
        expect(mail.enviarEmail).not.toHaveBeenCalled();
      },
    );

    it('devolução inexistente: 404', async () => {
      await expect(service.aprovar(999, ADMIN_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('duas decisões simultâneas (aprovar x recusar): só uma vale, a outra recebe 409', async () => {
      novaDevolucao();

      const resultados = await Promise.allSettled([
        service.aprovar(1, ADMIN_ID),
        service.recusar(1, ADMIN_ID, 'Não'),
      ]);

      const aceitas = resultados.filter((r) => r.status === 'fulfilled');
      const recusadas = resultados.filter((r) => r.status === 'rejected');
      expect(aceitas).toHaveLength(1);
      expect(recusadas).toHaveLength(1);
      expect(recusadas[0].reason).toBeInstanceOf(ConflictException);
      expect(mail.enviarEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('e-mail ao cliente', () => {
    it('aprovação: um e-mail, para o usuário da devolução, depois de gravar', async () => {
      novaDevolucao();

      await service.aprovar(1, ADMIN_ID);

      expect(mail.enviarEmail).toHaveBeenCalledTimes(1);
      const [{ to, subject, html }] = mail.enviarEmail.mock.calls[0] as [
        { to: string; subject: string; html: string },
      ];
      expect(to).toBe('cliente@sensora.dev');
      expect(subject).toBe('Devolução aprovada — pedido PED-10');
      expect(html).toContain('foi aprovada');
      expect(html).toContain('instruções para enviar o produto');
      // A decisão já estava gravada quando o e-mail foi montado.
      expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        mail.enviarEmail.mock.invocationCallOrder[0],
      );
    });

    it('recusa: inclui a observação da recusa', async () => {
      novaDevolucao();

      await service.recusar(1, ADMIN_ID, 'Produto com sinais de uso');

      const [{ subject, html }] = mail.enviarEmail.mock.calls[0] as [
        { subject: string; html: string },
      ];
      expect(subject).toBe('Devolução não aprovada — pedido PED-10');
      expect(html).toContain('não foi aprovada');
      expect(html).toContain('Motivo da recusa: Produto com sinais de uso');
    });

    it('usuário excluído: envia para o e-mail gravado no pedido', async () => {
      novaDevolucao({ usuarioId: null });

      await service.aprovar(1, ADMIN_ID);

      const [{ to }] = mail.enviarEmail.mock.calls[0] as [{ to: string }];
      expect(to).toBe('pedido@sensora.dev');
    });

    it('escapa HTML de nome, número do pedido, motivo, descrição e observação', async () => {
      usuarios.set(1, {
        nome: '<b>Ana</b>',
        email: 'cliente@sensora.dev',
      });
      pedido.numero = 'PED-<i>10</i>';
      novaDevolucao({
        motivo: '<script>alert(1)</script>',
        descricao: '"aspas" & <u>tag</u>',
      });

      await service.recusar(1, ADMIN_ID, '<img src=x onerror=alert(1)>');

      const [{ html }] = mail.enviarEmail.mock.calls[0] as [{ html: string }];
      expect(html).not.toMatch(/<script|<b>|<i>|<u>|<img/);
      expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
      expect(html).toContain('PED-&lt;i&gt;10&lt;/i&gt;');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).toContain('&quot;aspas&quot; &amp; &lt;u&gt;tag&lt;/u&gt;');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('falha no envio do e-mail não desfaz a decisão', async () => {
      novaDevolucao();
      mail.enviarEmail.mockRejectedValueOnce(new Error('Resend fora do ar'));

      const resultado = await service.aprovar(1, ADMIN_ID);

      expect(resultado.status).toBe(StatusDevolucao.APROVADA);
      expect(devolucoes[0].status).toBe(StatusDevolucao.APROVADA);
    });
  });
});
