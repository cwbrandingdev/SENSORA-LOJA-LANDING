import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

// Usuários do "banco" para o aviso de nova devolução: só os ADMIN ativos
// devem receber o e-mail.
type UsuarioFake = {
  id: number;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
};
const ADMIN_1: UsuarioFake = {
  id: 50,
  email: 'admin1@sensora.dev',
  perfil: PerfilUsuario.ADMIN,
  ativo: true,
};
const ADMIN_2: UsuarioFake = {
  id: 51,
  email: 'admin2@sensora.dev',
  perfil: PerfilUsuario.ADMIN,
  ativo: true,
};
const ADMIN_INATIVO: UsuarioFake = {
  id: 52,
  email: 'antigo@sensora.dev',
  perfil: PerfilUsuario.ADMIN,
  ativo: false,
};
const VENDEDOR: UsuarioFake = {
  id: 53,
  email: 'vendedor@sensora.dev',
  perfil: PerfilUsuario.VENDEDOR,
  ativo: true,
};

const NOMES_PRODUTOS: Record<number, string> = {
  100: 'Vela Lavanda',
  200: 'Spray Alecrim',
};

// Mock com todos os métodos públicos do service real, para provar que
// nenhum deles é chamado durante a criação.
function mockDeTodosOsMetodos(classe: { prototype: object }) {
  return Object.fromEntries(
    Object.getOwnPropertyNames(classe.prototype)
      .filter((nome) => nome !== 'constructor')
      .map((nome) => [nome, jest.fn()]),
  ) as Record<string, jest.Mock>;
}

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
  let usuariosFake: UsuarioFake[];
  let nomeCliente: string;
  let frontendUrl: string | undefined;
  let enviarEmail: jest.Mock;
  let buscarAdmins: jest.Mock;
  let asaas: Record<string, jest.Mock>;
  let melhorEnvio: Record<string, jest.Mock>;
  let imagekit: Record<string, jest.Mock>;
  let avisoLog: jest.SpyInstance;
  let infoLog: jest.SpyInstance;
  let erroLog: jest.SpyInstance;

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
    usuariosFake = [ADMIN_1, ADMIN_2, ADMIN_INATIVO, VENDEDOR];
    nomeCliente = 'Ana Souza';
    frontendUrl = 'https://sensorahome.com.br/';
    enviarEmail = jest.fn().mockResolvedValue(undefined);
    buscarAdmins = jest.fn(
      ({ where }: { where: { perfil: PerfilUsuario; ativo: boolean } }) =>
        usuariosFake
          .filter((u) => u.perfil === where.perfil && u.ativo === where.ativo)
          .map((u) => ({ id: u.id, email: u.email })),
    );
    asaas = mockDeTodosOsMetodos(AsaasService);
    melhorEnvio = mockDeTodosOsMetodos(MelhorEnvioService);
    imagekit = mockDeTodosOsMetodos(ImagekitService);
    avisoLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    infoLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    erroLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    // 30 s depois do horário em que o fake grava as devoluções: dentro da
    // janela de repetição.
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-09-29T12:00:30Z').getTime());

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
              findMany: jest.fn(
                ({
                  where,
                }: {
                  where: {
                    pedidoId: number;
                    usuarioId: number;
                    status: StatusDevolucao;
                    solicitadaEm: { gte: Date };
                  };
                }) =>
                  devolucoesFake
                    .filter(
                      (d) =>
                        d.pedidoId === where.pedidoId &&
                        d.usuarioId === where.usuarioId &&
                        d.status === where.status &&
                        d.solicitadaEm >= where.solicitadaEm.gte,
                    )
                    .map((d) => ({
                      ...d,
                      itens: d.itens.map((i) => ({ ...i })),
                    })),
              ),
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
      // Leituras do aviso aos admins, feitas fora da transação.
      usuario: { findMany: buscarAdmins },
      devolucao: {
        findUnique: jest.fn(({ where }: { where: { id: number } }) => {
          const devolucao = devolucoesFake.find((d) => d.id === where.id);
          if (!devolucao) return null;
          return {
            ...devolucao,
            usuario: { nome: nomeCliente, email: CLIENTE.email },
            pedido: {
              numero: 'SEN-0010',
              clienteNome: nomeCliente,
              clienteEmail: CLIENTE.email,
            },
            itens: devolucao.itens.map((item) => ({
              ...item,
              itemPedido: {
                produto: { nome: NOMES_PRODUTOS[item.itemPedidoId] },
              },
            })),
          };
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevolucoesService,
        { provide: PrismaService, useValue: prisma },
        // A criação não usa ImageKit, Melhor Envio nem Asaas (conferido no
        // teste AA).
        { provide: ImagekitService, useValue: imagekit },
        { provide: MailService, useValue: { enviarEmail } },
        { provide: MelhorEnvioService, useValue: melhorEnvio },
        { provide: AsaasService, useValue: asaas },
        { provide: OcorrenciasService, useValue: { registrar: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: (chave: string) =>
              chave === 'FRONTEND_URL' ? frontendUrl : undefined,
          },
        },
      ],
    }).compile();

    service = module.get(DevolucoesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  // Duas solicitações DIFERENTES que, somadas, passam do saldo. A repetição
  // idêntica é reaproveitada (testes AB a AD).
  it('S: duas solicitações simultâneas (2 + 2 de 3 compradas) — só uma é aceita', async () => {
    const resultados = await Promise.allSettled([
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 2 }]), CLIENTE),
      service.criar(
        10,
        dto([
          { itemPedidoId: 100, quantidade: 2 },
          { itemPedidoId: 200, quantidade: 1 },
        ]),
        CLIENTE,
      ),
    ]);

    const aceitas = resultados.filter((r) => r.status === 'fulfilled');
    const recusadas = resultados.filter((r) => r.status === 'rejected');
    expect(aceitas).toHaveLength(1);
    expect(recusadas).toHaveLength(1);
    expect(recusadas[0].reason).toBeInstanceOf(BadRequestException);

    const totalDevolvido = devolucoesFake
      .flatMap((d) => d.itens)
      .filter((item) => item.itemPedidoId === 100)
      .reduce((soma, item) => soma + item.quantidade, 0);
    expect(totalDevolvido).toBe(2);
  });

  // -------------------------------------------------------------------
  // Aviso aos admins e repetição acidental
  // -------------------------------------------------------------------

  function htmlEnviado(chamada = 0): string {
    return (enviarEmail.mock.calls[chamada] as [{ html: string }])[0].html;
  }

  function destinatarios(): string[] {
    return (enviarEmail.mock.calls as [{ to: string }][]).map(
      ([params]) => params.to,
    );
  }

  it('T: envia um e-mail a cada ADMIN ativo com pedido, cliente, itens, motivo e link', async () => {
    await service.criar(
      10,
      dto([
        { itemPedidoId: 100, quantidade: 2 },
        { itemPedidoId: 200, quantidade: 1 },
      ]),
      CLIENTE,
    );

    expect(destinatarios()).toEqual([ADMIN_1.email, ADMIN_2.email]);
    const [{ subject }] = enviarEmail.mock.calls[0] as [{ subject: string }];
    expect(subject).toBe('Nova solicitação de devolução — pedido SEN-0010');
    const html = htmlEnviado();
    expect(html).toContain('Pedido: SEN-0010');
    expect(html).toContain('Cliente: Ana Souza (cliente@sensora.dev)');
    expect(html).toContain('<li>2 × Vela Lavanda</li>');
    expect(html).toContain('<li>1 × Spray Alecrim</li>');
    expect(html).toContain('Motivo: Chegou quebrada');
    expect(html).toContain(
      'href="https://sensorahome.com.br/workspace-x/devolucoes/1"',
    );
    // Fica registrado que o aviso foi disparado (sem nenhum endereço).
    expect(infoLog).toHaveBeenCalledWith(
      'Aviso da nova devolução 1 enviado ao provedor para 2 administrador(es) ativo(s).',
    );
    expect(JSON.stringify(infoLog.mock.calls)).not.toContain('@');
  });

  it('U: VENDEDOR e ADMIN inativo não recebem; a consulta pede só ADMIN ativo', async () => {
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );

    expect(buscarAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { perfil: PerfilUsuario.ADMIN, ativo: true },
      }),
    );
    expect(destinatarios()).not.toContain(VENDEDOR.email);
    expect(destinatarios()).not.toContain(ADMIN_INATIVO.email);
  });

  it('V: texto do cliente é escapado no HTML', async () => {
    nomeCliente = '<b>Ana</b>';
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }], {
        motivo: '<script>alert("x")</script>',
        descricao: '<img src=x onerror=alert(1)>',
      }),
      CLIENTE,
    );

    const html = htmlEnviado();
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>Ana</b>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
  });

  it('W: falha no envio a um admin não impede o envio aos outros', async () => {
    enviarEmail.mockRejectedValueOnce(new Error('SMTP fora do ar'));

    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );

    expect(destinatarios()).toEqual([ADMIN_1.email, ADMIN_2.email]);
    expect(erroLog).toHaveBeenCalledTimes(1);
    // O endereço do admin nunca vai para o log.
    expect(JSON.stringify(erroLog.mock.calls)).not.toContain(ADMIN_1.email);
  });

  it('X: falha no aviso (e-mail ou leitura) não desfaz nem esconde a devolução', async () => {
    enviarEmail.mockRejectedValue(new Error('SMTP fora do ar'));

    const resultado = await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );
    expect(resultado.status).toBe(StatusDevolucao.SOLICITADA);
    expect(devolucoesFake).toHaveLength(1);

    buscarAdmins.mockRejectedValueOnce(new Error('banco indisponível'));
    const segunda = await service.criar(
      10,
      dto([{ itemPedidoId: 200, quantidade: 1 }]),
      CLIENTE,
    );
    expect(segunda.id).toBe(2);
    expect(devolucoesFake).toHaveLength(2);
  });

  it('Y: sem ADMIN ativo, registra aviso no log e não envia nada', async () => {
    usuariosFake = [ADMIN_INATIVO, VENDEDOR];

    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );

    expect(enviarEmail).not.toHaveBeenCalled();
    expect(avisoLog).toHaveBeenCalledWith(
      'Nenhum administrador ativo — aviso da nova devolução 1 não enviado.',
    );
    expect(infoLog).not.toHaveBeenCalledWith(
      expect.stringContaining('Aviso da nova devolução'),
    );
    expect(devolucoesFake).toHaveLength(1);
  });

  it('Z: criação recusada ou com falha não avisa ninguém', async () => {
    await expect(
      service.criar(
        10,
        dto([{ itemPedidoId: 100, quantidade: 1 }]),
        OUTRO_CLIENTE,
      ),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 9 }]), CLIENTE),
    ).rejects.toThrow(BadRequestException);
    pedidoFake!.statusEnvio = StatusEnvio.NAO_ENVIADO;
    await expect(
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 1 }]), CLIENTE),
    ).rejects.toThrow(ConflictException);
    pedidoFake!.statusEnvio = StatusEnvio.ENVIADO;
    falharCriacao = true;
    await expect(
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 1 }]), CLIENTE),
    ).rejects.toThrow('Falha simulada ao gravar');

    expect(buscarAdmins).not.toHaveBeenCalled();
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  it('AA: a criação não chama Asaas, Melhor Envio nem ImageKit', async () => {
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );

    for (const metodo of [
      ...Object.values(asaas),
      ...Object.values(melhorEnvio),
      ...Object.values(imagekit),
    ]) {
      expect(metodo).not.toHaveBeenCalled();
    }
  });

  it('AB: repetição idêntica dentro da janela devolve a mesma devolução, sem novo registro nem e-mail', async () => {
    const primeira = await service.criar(
      10,
      dto([
        { itemPedidoId: 100, quantidade: 1 },
        { itemPedidoId: 200, quantidade: 1 },
      ]),
      CLIENTE,
    );
    // Mesmos itens em outra ordem.
    const repetida = await service.criar(
      10,
      dto([
        { itemPedidoId: 200, quantidade: 1 },
        { itemPedidoId: 100, quantidade: 1 },
      ]),
      CLIENTE,
    );

    expect(repetida.id).toBe(primeira.id);
    expect(devolucoesFake).toHaveLength(1);
    expect(criarDevolucao).toHaveBeenCalledTimes(1);
    // Só os 2 e-mails da primeira (um por admin).
    expect(enviarEmail).toHaveBeenCalledTimes(2);
  });

  it('AC: clique duplo simultâneo (mesma solicitação) gera um único registro', async () => {
    const [a, b] = await Promise.all([
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 2 }]), CLIENTE),
      service.criar(10, dto([{ itemPedidoId: 100, quantidade: 2 }]), CLIENTE),
    ]);

    expect(a.id).toBe(b.id);
    expect(devolucoesFake).toHaveLength(1);
    expect(enviarEmail).toHaveBeenCalledTimes(2);
  });

  it('AD: repetição com o saldo já esgotado devolve a existente em vez de 400', async () => {
    const primeira = await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 3 }]),
      CLIENTE,
    );
    const repetida = await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 3 }]),
      CLIENTE,
    );

    expect(repetida.id).toBe(primeira.id);
    expect(devolucoesFake).toHaveLength(1);
  });

  it('AE: solicitação diferente na janela é criada normalmente e avisa de novo', async () => {
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 2 }]),
      CLIENTE,
    );

    expect(devolucoesFake).toHaveLength(2);
    expect(enviarEmail).toHaveBeenCalledTimes(4);
  });

  it('AF: fora da janela, ou com a anterior fora de SOLICITADA, a igual é criada', async () => {
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );
    // 61 s depois da primeira.
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-09-29T12:01:01Z').getTime());
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );
    expect(devolucoesFake).toHaveLength(2);

    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-09-29T12:00:30Z').getTime());
    devolucoesFake[0].status = StatusDevolucao.APROVADA;
    devolucoesFake[1].status = StatusDevolucao.APROVADA;
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );
    expect(devolucoesFake).toHaveLength(3);
  });

  it('AG: sem FRONTEND_URL, o e-mail orienta a abrir o painel e não inventa link', async () => {
    frontendUrl = undefined;

    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }]),
      CLIENTE,
    );

    const html = htmlEnviado();
    expect(html).not.toContain('href=');
    expect(html).toContain(
      'Acesse o painel administrativo, em Devoluções, para analisar a solicitação.',
    );
  });

  // Motivo e descrição também identificam a repetição (texto normalizado:
  // pontas e sequências de espaços/quebras de linha não contam).

  it('AH: idêntica com descrição dentro da janela reaproveita, sem outro e-mail', async () => {
    const pedido = dto([{ itemPedidoId: 100, quantidade: 1 }], {
      descricao: 'Tampa rachada',
    });
    const primeira = await service.criar(10, pedido, CLIENTE);
    const repetida = await service.criar(10, pedido, CLIENTE);

    expect(repetida.id).toBe(primeira.id);
    expect(devolucoesFake).toHaveLength(1);
    expect(enviarEmail).toHaveBeenCalledTimes(2);
  });

  it('AI: motivo diferente cria outra solicitação e avisa de novo', async () => {
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }], {
        motivo: 'Chegou quebrada',
      }),
      CLIENTE,
    );
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }], {
        motivo: 'Aroma diferente do anunciado',
      }),
      CLIENTE,
    );

    expect(devolucoesFake).toHaveLength(2);
    expect(devolucoesFake.map((d) => d.motivo)).toEqual([
      'Chegou quebrada',
      'Aroma diferente do anunciado',
    ]);
    expect(enviarEmail).toHaveBeenCalledTimes(4);
  });

  it('AJ: descrição diferente (outra, ausente ou nova) cria outra solicitação', async () => {
    const itens = [{ itemPedidoId: 100, quantidade: 1 }];
    await service.criar(
      10,
      dto(itens, { descricao: 'Tampa rachada' }),
      CLIENTE,
    );
    await service.criar(
      10,
      dto(itens, { descricao: 'Vidro trincado' }),
      CLIENTE,
    );
    await service.criar(10, dto(itens), CLIENTE);

    expect(devolucoesFake.map((d) => d.descricao)).toEqual([
      'Tampa rachada',
      'Vidro trincado',
      null,
    ]);
    expect(enviarEmail).toHaveBeenCalledTimes(6);
  });

  it('AK: diferenças só de espaços e quebras de linha contam como a mesma solicitação', async () => {
    const primeira = await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }], {
        motivo: 'Chegou quebrada',
        descricao: 'Tampa rachada no transporte',
      }),
      CLIENTE,
    );
    const repetida = await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 1 }], {
        motivo: '  Chegou    quebrada ',
        descricao: 'Tampa rachada\n  no\ttransporte  ',
      }),
      CLIENTE,
    );
    // Descrição só com espaços equivale a nenhuma descrição.
    const semDescricao = await service.criar(
      10,
      dto([{ itemPedidoId: 200, quantidade: 1 }]),
      CLIENTE,
    );
    const comEspacos = await service.criar(
      10,
      dto([{ itemPedidoId: 200, quantidade: 1 }], { descricao: '   ' }),
      CLIENTE,
    );

    expect(repetida.id).toBe(primeira.id);
    expect(comEspacos.id).toBe(semDescricao.id);
    expect(devolucoesFake).toHaveLength(2);
  });

  it('AL: maiúsculas, letras e pontuação diferentes não são a mesma solicitação', async () => {
    const itens = [{ itemPedidoId: 100, quantidade: 1 }];
    await service.criar(10, dto(itens, { motivo: 'Chegou quebrada' }), CLIENTE);
    await service.criar(10, dto(itens, { motivo: 'chegou quebrada' }), CLIENTE);
    await service.criar(
      10,
      dto(itens, { motivo: 'Chegou quebrada.' }),
      CLIENTE,
    );

    expect(devolucoesFake).toHaveLength(3);
  });

  it('AM: motivos diferentes ao mesmo tempo continuam limitados pelo saldo (2 + 2 de 3)', async () => {
    const resultados = await Promise.allSettled([
      service.criar(
        10,
        dto([{ itemPedidoId: 100, quantidade: 2 }], { motivo: 'Quebrada' }),
        CLIENTE,
      ),
      service.criar(
        10,
        dto([{ itemPedidoId: 100, quantidade: 2 }], { motivo: 'Vazando' }),
        CLIENTE,
      ),
    ]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const recusadas = resultados.filter((r) => r.status === 'rejected');
    expect(recusadas).toHaveLength(1);
    expect(recusadas[0].reason).toBeInstanceOf(BadRequestException);
    expect(devolucoesFake).toHaveLength(1);
    expect(devolucoesFake[0].itens[0].quantidade).toBe(2);
    // Só a aceita avisa os admins.
    expect(enviarEmail).toHaveBeenCalledTimes(2);
  });

  it('AN: com o saldo esgotado, a mesma quantidade com outro motivo é recusada (400)', async () => {
    await service.criar(
      10,
      dto([{ itemPedidoId: 100, quantidade: 3 }], { motivo: 'Quebrada' }),
      CLIENTE,
    );

    await expect(
      service.criar(
        10,
        dto([{ itemPedidoId: 100, quantidade: 3 }], { motivo: 'Vazando' }),
        CLIENTE,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(devolucoesFake).toHaveLength(1);
  });
});
