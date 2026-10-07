import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ImagekitService } from '../imagekit/imagekit.service';
import { MailService } from '../mail/mail.service';
import { AsaasService } from '../asaas/asaas.service';
import { OcorrenciasService } from '../ocorrencias/ocorrencias.service';
import { MelhorEnvioService } from '../melhor-envio/melhor-envio.service';
import { StatusEnvio } from '../pedidos/enums/status-envio.enum';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { DevolucoesService } from './devolucoes.service';
import { CreateDevolucaoDto } from './dto/create-devolucao.dto';
import { StatusDevolucao } from './enums/status-devolucao.enum';

// Prisma MOCKADO com um "banco" em memória (mesmo padrão de
// pedidos.service.spec.ts): nenhum banco real, nenhum dado persistente.
// A transação desfaz o que foi gravado se o callback falhar, e o
// `$queryRaw` (SELECT ... FOR UPDATE) é simulado como uma trava: a segunda
// transação só passa dele depois que a primeira termina.

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

type ItemPedidoFake = {
  id: number;
  pedidoId: number;
  quantidade: number;
  precoUnitario: number;
};
type DevolucaoFake = {
  id: number;
  pedidoId: number;
  usuarioId: number;
  motivo: string;
  descricao: string | null;
  status: StatusDevolucao;
  solicitadaEm: Date;
  itens: {
    id: number;
    devolucaoId: number;
    itemPedidoId: number;
    quantidade: number;
    precoUnitario: number;
  }[];
};

function dto(
  itens: { itemPedidoId: number; quantidade: number }[],
  extras: Partial<CreateDevolucaoDto> = {},
): CreateDevolucaoDto {
  return { motivo: 'Chegou quebrada', itens, ...extras };
}

describe('DevolucoesService — criar (Etapa 3)', () => {
  let service: DevolucoesService;
  let pedidoFake: {
    id: number;
    usuarioId: number | null;
    status: StatusPedido;
    statusEnvio: StatusEnvio;
    itens: ItemPedidoFake[];
  } | null;
  let devolucoesFake: DevolucaoFake[];
  let cadeado: Promise<void>;
  let falharCriacao: boolean;
  let queryRaw: jest.Mock;
  let criarDevolucao: jest.Mock;

  beforeEach(async () => {
    pedidoFake = {
      id: 10,
      usuarioId: CLIENTE.id,
      status: StatusPedido.PAGO,
      statusEnvio: StatusEnvio.ENVIADO,
      itens: [
        { id: 100, pedidoId: 10, quantidade: 3, precoUnitario: 50 },
        { id: 200, pedidoId: 10, quantidade: 1, precoUnitario: 80 },
      ],
    };
    devolucoesFake = [];
    cadeado = Promise.resolve();
    falharCriacao = false;

    queryRaw = jest.fn();
    criarDevolucao = jest.fn();

    const prisma = {
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          // Rollback desfaz só o que ESTA transação gravou (como o banco).
          const criadasNestaTransacao: DevolucaoFake[] = [];
          let liberarTrava = () => {};

          const tx = {
            $queryRaw: async (
              sql: TemplateStringsArray,
              ...valores: unknown[]
            ) => {
              queryRaw(sql, ...valores);
              const anterior = cadeado;
              cadeado = new Promise<void>((liberar) => {
                liberarTrava = liberar;
              });
              await anterior;
            },
            pedido: {
              findUnique: jest.fn(() =>
                pedidoFake
                  ? {
                      ...pedidoFake,
                      itens: pedidoFake.itens.map((i) => ({ ...i })),
                    }
                  : null,
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
                    .filter(
                      (d) => !where.devolucao.status.notIn.includes(d.status),
                    )
                    .flatMap((d) => d.itens)
                    .filter((i) =>
                      where.itemPedidoId.in.includes(i.itemPedidoId),
                    )
                    .map((i) => ({
                      itemPedidoId: i.itemPedidoId,
                      quantidade: i.quantidade,
                    })),
              ),
            },
            devolucao: {
              create: (args: {
                data: Omit<DevolucaoFake, 'id' | 'solicitadaEm' | 'itens'> & {
                  itens: {
                    create: {
                      itemPedidoId: number;
                      quantidade: number;
                      precoUnitario: number;
                    }[];
                  };
                };
              }) => {
                criarDevolucao(args);
                const { data } = args;
                if (falharCriacao) {
                  throw new Error('Falha simulada ao gravar');
                }
                const id = devolucoesFake.length + 1;
                const nova: DevolucaoFake = {
                  id,
                  pedidoId: data.pedidoId,
                  usuarioId: data.usuarioId,
                  motivo: data.motivo,
                  descricao: data.descricao,
                  status: data.status,
                  solicitadaEm: new Date('2026-09-29T12:00:00Z'),
                  itens: data.itens.create.map((item, indice) => ({
                    id: indice + 1,
                    devolucaoId: id,
                    ...item,
                  })),
                };
                devolucoesFake.push(nova);
                criadasNestaTransacao.push(nova);
                return nova;
              },
            },
          };

          try {
            return await callback(tx);
          } catch (erro) {
            devolucoesFake = devolucoesFake.filter(
              (d) => !criadasNestaTransacao.includes(d),
            );
            throw erro;
          } finally {
            liberarTrava();
          }
        },
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevolucoesService,
        { provide: PrismaService, useValue: prisma },
        // A criação não usa o ImageKit.
        { provide: ImagekitService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: MelhorEnvioService, useValue: {} },
        { provide: AsaasService, useValue: {} },
        { provide: OcorrenciasService, useValue: { registrar: jest.fn() } },
      ],
    }).compile();

    service = module.get(DevolucoesService);
  });

  function devolucaoAnterior(
    itemPedidoId: number,
    quantidade: number,
    status: StatusDevolucao,
  ) {
    devolucoesFake.push({
      id: devolucoesFake.length + 1,
      pedidoId: 10,
      usuarioId: CLIENTE.id,
      motivo: 'Anterior',
      descricao: null,
      status,
      solicitadaEm: new Date('2026-09-20'),
      itens: [
        { id: 1, devolucaoId: 1, itemPedidoId, quantidade, precoUnitario: 50 },
      ],
    });
  }

  it('A: cria a devolução do próprio pedido ENVIADO com status SOLICITADA', async () => {
    const resultado = await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }], {
        descricao: 'Tampa rachada',
      }),
      CLIENTE,
    );

    expect(resultado).toEqual({
      id: 1,
      pedidoId: 10,
      status: StatusDevolucao.SOLICITADA,
      motivo: 'Chegou quebrada',
      descricao: 'Tampa rachada',
      solicitadaEm: new Date('2026-09-29T12:00:00Z'),
      analisadaEm: null,
      itens: [
        {
          id: 1,
          itemPedidoId: 100,
          quantidade: 1,
          precoUnitario: 50,
          quantidadeAceita: null,
        },
      ],
      reembolsoValor: null,
      reembolsadaEm: null,
      evidencias: [],
      envio: null,
    });
    expect(devolucoesFake).toHaveLength(1);
    expect(devolucoesFake[0].usuarioId).toBe(CLIENTE.id);
  });

  it('B: aceita múltiplos itens, cada um com seu preço do pedido', async () => {
    const resultado = await service.criar(
      10,
      dto([
        { itemPedidoId: 100, quantidade: 2 },
        { itemPedidoId: 200, quantidade: 1 },
      ]),
      CLIENTE,
    );

    expect(resultado.itens).toEqual([
      {
        id: 1,
        itemPedidoId: 100,
        quantidade: 2,
        precoUnitario: 50,
        quantidadeAceita: null,
      },
      {
        id: 2,
        itemPedidoId: 200,
        quantidade: 1,
        precoUnitario: 80,
        quantidadeAceita: null,
      },
    ]);
  });

  it('C: quantidade parcial (1 de 3) é aceita', async () => {
    const resultado = await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );

    expect(resultado.itens[0].quantidade).toBe(1);
  });

  it('D: descrição ausente vira null e o motivo é salvo sem espaços extras', async () => {
    const resultado = await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }], {
        motivo: '  Cheiro fraco  ',
      }),
      CLIENTE,
    );

    expect(resultado.motivo).toBe('Cheiro fraco');
    expect(resultado.descricao).toBeNull();
  });

  it('E: pedido de outro usuário responde 404 e nada é criado', async () => {
    await expect(
      service.criar(
        10,
        dto([{ itemPedidoId: 100, quantidade: 1 }]),
        OUTRO_CLIENTE,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(criarDevolucao).not.toHaveBeenCalled();
  });

  it('F: pedido inexistente responde 404', async () => {
    pedidoFake = null;

    await expect(
      service.criar(999, dto([{ itemPedidoId: 100, quantidade: 1 }]), CLIENTE),
    ).rejects.toThrow(
      new NotFoundException('Pedido com id 999 não encontrado'),
    );
  });

  it('G: pedido PAGO e NAO_ENVIADO é recusado (usa o reembolso, não a devolução)', async () => {
    pedidoFake!.statusEnvio = StatusEnvio.NAO_ENVIADO;

    await expect(
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 1 }]), CLIENTE),
    ).rejects.toThrow(ConflictException);
    expect(criarDevolucao).not.toHaveBeenCalled();
  });

  it.each([
    StatusPedido.PENDENTE,
    StatusPedido.CANCELADO,
    StatusPedido.REEMBOLSO_SOLICITADO,
    StatusPedido.REEMBOLSADO,
  ])('H: pedido %s (mesmo ENVIADO) é recusado', async (status) => {
    pedidoFake!.status = status;

    await expect(
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 1 }]), CLIENTE),
    ).rejects.toThrow(ConflictException);
    expect(criarDevolucao).not.toHaveBeenCalled();
  });

  it('I: item de outro pedido (ou inexistente) é recusado', async () => {
    await expect(
      service.criar(10, dto([{ itemPedidoId: 999, quantidade: 1 }]), CLIENTE),
    ).rejects.toThrow(
      new BadRequestException('Item 999 não pertence a este pedido.'),
    );
    expect(criarDevolucao).not.toHaveBeenCalled();
  });

  it('J: quantidade maior que a comprada é recusada', async () => {
    await expect(
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 4 }]), CLIENTE),
    ).rejects.toThrow(BadRequestException);
    expect(criarDevolucao).not.toHaveBeenCalled();
  });

  it('K: saldo após devolução anterior — comprou 3, já devolveu 2: aceita 1, recusa 2', async () => {
    devolucaoAnterior(100, 2, StatusDevolucao.SOLICITADA);

    await expect(
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 2 }]), CLIENTE),
    ).rejects.toThrow(
      new BadRequestException(
        'Quantidade indisponível para devolução do item 100: máximo 1.',
      ),
    );

    const resultado = await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );
    expect(resultado.itens[0].quantidade).toBe(1);
  });

  it('L: devoluções RECUSADA/CANCELADA não consomem o saldo do item', async () => {
    devolucaoAnterior(100, 3, StatusDevolucao.RECUSADA);
    devolucaoAnterior(100, 3, StatusDevolucao.CANCELADA);

    const resultado = await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 3 }]),
      CLIENTE,
    );

    expect(resultado.itens[0].quantidade).toBe(3);
  });

  it('M: mesmo item repetido na solicitação é recusado', async () => {
    await expect(
      service.criar(
        10,
        dto([
          { itemPedidoId: 100, quantidade: 1 },
          { itemPedidoId: 100, quantidade: 1 },
        ]),
        CLIENTE,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(criarDevolucao).not.toHaveBeenCalled();
  });

  it('N: motivo só com espaços é recusado', async () => {
    await expect(
      service.criar(
        10,
        dto([{ itemPedidoId: 100, quantidade: 1 }], { motivo: '   ' }),
        CLIENTE,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('O: usuário, status e preço vindos do corpo são ignorados', async () => {
    const corpoManipulado = {
      motivo: 'Chegou quebrada',
      usuarioId: 999,
      status: StatusDevolucao.CONCLUIDA,
      itens: [{ itemPedidoId: 100, quantidade: 1, precoUnitario: 0.01 }],
    } as unknown as CreateDevolucaoDto;

    const resultado = await service.criar(10, corpoManipulado, CLIENTE);

    expect(resultado.status).toBe(StatusDevolucao.SOLICITADA);
    expect(resultado.itens[0].precoUnitario).toBe(50);
    expect(devolucoesFake[0].usuarioId).toBe(CLIENTE.id);
    const [{ data }] = criarDevolucao.mock.calls[0] as [
      { data: { usuarioId: number; status: StatusDevolucao } },
    ];
    expect(data.usuarioId).toBe(CLIENTE.id);
    expect(data.status).toBe(StatusDevolucao.SOLICITADA);
  });

  it('P: erro em qualquer item (2º item inválido) não cria nada', async () => {
    await expect(
      service.criar(
        10,
        dto([
          { itemPedidoId: 100, quantidade: 1 },
          { itemPedidoId: 200, quantidade: 5 },
        ]),
        CLIENTE,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(criarDevolucao).not.toHaveBeenCalled();
    expect(devolucoesFake).toHaveLength(0);
  });

  it('Q: falha ao gravar dentro da transação não deixa devolução parcial', async () => {
    falharCriacao = true;

    await expect(
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 1 }]), CLIENTE),
    ).rejects.toThrow('Falha simulada ao gravar');

    expect(devolucoesFake).toHaveLength(0);
  });

  it('R: trava o pedido (SELECT ... FOR UPDATE) antes de ler o saldo', async () => {
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [partesDoSql] = queryRaw.mock.calls[0] as [string[]];
    const sql = partesDoSql.join('?');
    expect(sql).toContain('FOR UPDATE');
  });

  it('S: duas solicitações simultâneas (2 + 2 de 3 compradas) — só uma é aceita', async () => {
    const resultados = await Promise.allSettled([
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 2 }]), CLIENTE),
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 2 }]), CLIENTE),
    ]);

    const aceitas = resultados.filter((r) => r.status === 'fulfilled');
    const recusadas = resultados.filter((r) => r.status === 'rejected');
    expect(aceitas).toHaveLength(1);
    expect(recusadas).toHaveLength(1);
    expect(recusadas[0].reason).toBeInstanceOf(BadRequestException);

    const totalDevolvido = devolucoesFake
      .flatMap((d) => d.itens)
      .reduce((soma, item) => soma + item.quantidade, 0);
    expect(totalDevolvido).toBe(2);
  });
});
