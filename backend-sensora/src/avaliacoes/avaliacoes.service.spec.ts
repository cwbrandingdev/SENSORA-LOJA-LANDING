import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import {
  AvaliacoesService,
  DIAS_LEMBRETE_AVALIACAO,
  DIAS_MINIMOS_ENTREGA,
  dataLiberacaoAvaliacao,
  nomeParaExibicao,
} from './avaliacoes.service';
import { StatusAvaliacao } from './enums/status-avaliacao.enum';

const CLIENTE: UsuarioAutenticado = {
  id: 7,
  email: 'ana@sensora.dev',
  perfil: PerfilUsuario.CLIENTE,
};
const AGORA = new Date('2026-10-19T12:00:00Z');
const DIA_MS = 24 * 60 * 60 * 1000;
// Pedido pago e enviado há `diasAtras` dias, com `prazo` dias úteis de frete.
const enviado = (diasAtras: number, prazo: number | null = 5) => ({
  status: 'PAGO' as const,
  statusEnvio: 'ENVIADO' as const,
  enviadoEm: new Date(Date.now() - diasAtras * DIA_MS),
  fretePrazoDias: prazo,
});

// Primeiro argumento da primeira chamada de um mock.
const primeiraChamada = (mock: jest.Mock): unknown =>
  (mock.mock.calls as unknown[][])[0][0];

describe('AvaliacoesService', () => {
  let prisma: {
    pedido: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    usuario: { findUnique: jest.Mock };
    produto: { findFirst: jest.Mock };
    avaliacao: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      aggregate: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let enviarEmail: jest.Mock;
  let service: AvaliacoesService;

  beforeEach(() => {
    prisma = {
      pedido: {
        // Enviado há 10 dias com prazo de 5 dias úteis: já liberado.
        findFirst: jest.fn().mockResolvedValue({
          id: 1,
          ...enviado(10),
          itens: [{ produtoId: 10 }, { produtoId: 20 }],
        }),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ nome: 'Ana Souza Lima' }),
      },
      produto: { findFirst: jest.fn().mockResolvedValue({ id: 10 }) },
      avaliacao: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(
          ({
            create,
          }: {
            create: {
              produtoId: number;
              nota: number;
              comentario: string | null;
            };
          }) => ({
            ...create,
            status: StatusAvaliacao.PENDENTE,
            atualizadaEm: AGORA,
          }),
        ),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _avg: { nota: null }, _count: { _all: 0 } }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    enviarEmail = jest.fn();
    service = new AvaliacoesService(
      prisma as unknown as PrismaService,
      { enviarEmail } as unknown as MailService,
      {
        get: () => 'https://www.sensorahome.com.br/',
      } as unknown as ConfigService,
    );
  });

  it('liberação: envio + prazo do frete em dias corridos (mínimo 2); sem envio, nunca', () => {
    const base = new Date('2026-10-10T12:00:00Z');
    const dia = (data: Date | null) =>
      data ? Math.round((data.getTime() - base.getTime()) / DIA_MS) : null;
    const pedido = (prazo: number | null) => ({
      status: 'PAGO' as const,
      statusEnvio: 'ENVIADO' as const,
      enviadoEm: base,
      fretePrazoDias: prazo,
    });

    // 5 dias úteis -> 7 corridos.
    expect(dia(dataLiberacaoAvaliacao(pedido(5)))).toBe(7);
    expect(dia(dataLiberacaoAvaliacao(pedido(null)))).toBe(
      DIAS_MINIMOS_ENTREGA,
    );
    expect(dia(dataLiberacaoAvaliacao(pedido(1)))).toBe(DIAS_MINIMOS_ENTREGA);
    expect(
      dataLiberacaoAvaliacao({
        ...pedido(5),
        statusEnvio: 'NAO_ENVIADO' as const,
      }),
    ).toBeNull();
    expect(
      dataLiberacaoAvaliacao({ ...pedido(5), status: 'PENDENTE' as const }),
    ).toBeNull();
  });

  it('nome exibido: primeiro nome + inicial do último sobrenome', () => {
    expect(nomeParaExibicao('Ana Souza Lima')).toBe('Ana L.');
    expect(nomeParaExibicao('  ana  ')).toBe('ana');
    expect(nomeParaExibicao('')).toBe('Cliente');
  });

  describe('salvar', () => {
    it('cria PENDENTE, com o nome abreviado e comentário sem espaços nas pontas', async () => {
      const salva = await service.salvar(
        1,
        10,
        { nota: 5, comentario: '  Amei!  ' },
        CLIENTE,
      );

      expect(prisma.pedido.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1, usuarioId: 7 } }),
      );
      expect(prisma.avaliacao.upsert).toHaveBeenCalledWith({
        where: { pedidoId_produtoId: { pedidoId: 1, produtoId: 10 } },
        create: {
          pedidoId: 1,
          produtoId: 10,
          usuarioId: 7,
          nomeExibicao: 'Ana L.',
          nota: 5,
          comentario: 'Amei!',
        },
        // Editar volta para a fila de aprovação.
        update: {
          nota: 5,
          comentario: 'Amei!',
          status: StatusAvaliacao.PENDENTE,
        },
      });
      expect(salva).toMatchObject({
        produtoId: 10,
        nota: 5,
        status: StatusAvaliacao.PENDENTE,
      });
    });

    it('pedido de outra pessoa: 404, nada gravado', async () => {
      prisma.pedido.findFirst.mockResolvedValueOnce(null);
      await expect(service.salvar(1, 10, { nota: 5 }, CLIENTE)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.avaliacao.upsert).not.toHaveBeenCalled();
    });

    it('antes da data prevista de entrega: 400, nada gravado', async () => {
      // Enviado ontem com prazo de 5 dias úteis: ainda a caminho.
      prisma.pedido.findFirst.mockResolvedValueOnce({
        id: 1,
        ...enviado(1),
        itens: [{ produtoId: 10 }],
      });
      await expect(service.salvar(1, 10, { nota: 5 }, CLIENTE)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.avaliacao.upsert).not.toHaveBeenCalled();
    });

    it('pedido ainda não enviado: 400', async () => {
      prisma.pedido.findFirst.mockResolvedValueOnce({
        id: 1,
        ...enviado(10),
        statusEnvio: 'NAO_ENVIADO',
        itens: [{ produtoId: 10 }],
      });
      await expect(service.salvar(1, 10, { nota: 5 }, CLIENTE)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('listarDoPedido devolve a data de liberação junto', async () => {
      const resposta = await service.listarDoPedido(1, CLIENTE);
      expect(resposta.liberadaEm).toBeInstanceOf(Date);
      expect(resposta.avaliacoes).toEqual([]);
    });

    it('produto que não é do pedido: 404', async () => {
      await expect(service.salvar(1, 99, { nota: 5 }, CLIENTE)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.avaliacao.upsert).not.toHaveBeenCalled();
    });

    it('comentário só com espaços vira null', async () => {
      await service.salvar(1, 10, { nota: 3, comentario: '   ' }, CLIENTE);
      const chamada = primeiraChamada(prisma.avaliacao.upsert) as {
        create: { comentario: unknown };
      };
      expect(chamada.create.comentario).toBeNull();
    });
  });

  describe('resumoPublico', () => {
    it('só as APROVADAS do produto ativo, média com uma casa', async () => {
      prisma.avaliacao.aggregate.mockResolvedValueOnce({
        _avg: { nota: 4.666 },
        _count: { _all: 3 },
      });

      const resumo = await service.resumoPublico('vela-luz-de-verao');

      expect(prisma.produto.findFirst).toHaveBeenCalledWith({
        where: { slug: 'vela-luz-de-verao', ativo: true },
        select: { id: true },
      });
      expect(prisma.avaliacao.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { produtoId: 10, status: StatusAvaliacao.APROVADA },
        }),
      );
      expect(resumo).toMatchObject({ media: 4.7, total: 3 });
    });

    it('sem avaliações: média null', async () => {
      await expect(service.resumoPublico('x')).resolves.toEqual({
        media: null,
        total: 0,
        avaliacoes: [],
      });
    });

    it('produto inexistente ou inativo: 404', async () => {
      prisma.produto.findFirst.mockResolvedValueOnce(null);
      await expect(service.resumoPublico('nao-existe')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it('atualizarStatus de id inexistente: 404', async () => {
    prisma.avaliacao.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.atualizarStatus(5, StatusAvaliacao.APROVADA),
    ).rejects.toThrow(NotFoundException);
  });

  describe('enviarLembretes', () => {
    // Enviado há `diasAtras` dias, prazo de 5 dias úteis (libera em 7 dias).
    const pedido = (id: number, avaliados: number[], diasAtras = 15) => ({
      id,
      numero: `PED-${id}`,
      ...enviado(diasAtras),
      itens: [{ produtoId: 10 }, { produtoId: 20 }],
      avaliacoes: avaliados.map((produtoId) => ({ produtoId })),
      usuario: { nome: 'Ana Souza', email: 'ana@sensora.dev' },
    });

    it('busca pagos e enviados, marca antes e envia só se falta avaliar', async () => {
      prisma.pedido.findMany.mockResolvedValueOnce([
        pedido(1, [10]),
        pedido(2, [10, 20]),
      ]);

      await service.enviarLembretes();

      const filtro = primeiraChamada(prisma.pedido.findMany) as {
        where: {
          status: string;
          statusEnvio: string;
          enviadoEm: { lte: Date };
          lembreteAvaliacaoEm: null;
        };
      };
      expect(filtro.where).toMatchObject({
        status: 'PAGO' as const,
        statusEnvio: 'ENVIADO' as const,
        lembreteAvaliacaoEm: null,
      });
      const dias = (Date.now() - filtro.where.enviadoEm.lte.getTime()) / DIA_MS;
      expect(Math.round(dias)).toBe(
        DIAS_MINIMOS_ENTREGA + DIAS_LEMBRETE_AVALIACAO,
      );
      // Os dois são marcados (o 2º, já todo avaliado, para sair da busca)...
      expect(prisma.pedido.updateMany).toHaveBeenCalledTimes(2);
      // ...mas só o 1º recebe o e-mail.
      expect(enviarEmail).toHaveBeenCalledTimes(1);
      const email = primeiraChamada(enviarEmail) as {
        to: string;
        subject: string;
        html: string;
      };
      expect(email.to).toBe('ana@sensora.dev');
      expect(email.subject).toContain('PED-1');
      expect(email.html).toContain(
        'https://www.sensorahome.com.br/conta/pedidos/1',
      );
    });

    it(`ainda dentro do prazo + ${DIAS_LEMBRETE_AVALIACAO} dias: não marca nem envia (fica para depois)`, async () => {
      // Libera em 7 dias; lembrete só a partir de 10. Enviado há 8.
      prisma.pedido.findMany.mockResolvedValueOnce([pedido(1, [], 8)]);

      await service.enviarLembretes();

      expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
      expect(enviarEmail).not.toHaveBeenCalled();
    });

    it('outra máquina já marcou o pedido: não envia de novo', async () => {
      prisma.pedido.findMany.mockResolvedValueOnce([pedido(1, [])]);
      prisma.pedido.updateMany.mockResolvedValueOnce({ count: 0 });

      await service.enviarLembretes();

      expect(enviarEmail).not.toHaveBeenCalled();
    });

    it('falha na busca não lança', async () => {
      prisma.pedido.findMany.mockRejectedValueOnce(new Error('banco fora'));
      await expect(service.enviarLembretes()).resolves.toBeUndefined();
    });
  });
});
