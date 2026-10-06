import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AsaasErroHttpError,
  AsaasIndisponivelError,
  AsaasService,
  type AsaasRefund,
} from '../asaas/asaas.service';
import { ImagekitService } from '../imagekit/imagekit.service';
import { MailService } from '../mail/mail.service';
import { MelhorEnvioService } from '../melhor-envio/melhor-envio.service';
import { StatusEnvio } from '../pedidos/enums/status-envio.enum';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PrismaService } from '../prisma/prisma.service';
import { DevolucoesService } from './devolucoes.service';
import { StatusDevolucao } from './enums/status-devolucao.enum';

// Etapa 9.1 — conferência, reembolso e fechamento. Prisma MOCKADO ("banco"
// em memória) e AsaasService MOCKADO (nenhuma chamada de rede). O fake de
// $transaction roda uma transação de cada vez (como o FOR UPDATE no pedido)
// e desfaz tudo o que ela escreveu se ela lançar (rollback) — é o que os
// testes de concorrência e de falha exercitam. Os fakes de escrita
// respeitam o WHERE no instante da escrita.

const ADMIN_ID = 99;

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
  recebidaEm: Date | null;
  conferidaEm: Date | null;
  conferidoPorId: number | null;
  observacaoConferencia: string | null;
  reembolsoValor: number | null;
  asaasRefundId: string | null;
  reembolsadaEm: Date | null;
  estoqueRestauradoEm: Date | null;
};

type ItemFake = {
  id: number;
  devolucaoId: number;
  itemPedidoId: number;
  quantidade: number;
  precoUnitario: number;
  quantidadeAceita: number | null;
};

type Estado = {
  pedido: {
    id: number;
    numero: string;
    data: Date;
    status: StatusPedido;
    statusEnvio: StatusEnvio;
    enviadoEm: Date | null;
    total: number;
    asaasPaymentId: string | null;
    asaasCheckoutId: string | null;
    clienteNome: string | null;
    clienteEmail: string | null;
  };
  devolucoes: DevolucaoFake[];
  itens: ItemFake[];
  itensPedido: Record<
    number,
    { produtoId: number; estoqueBaixado: boolean | null; quantidade: number }
  >;
  estoque: Record<number, number>;
};

// Filtros que o service usa: igualdade, { not } e { gt }.
function bate(
  linha: Record<string, unknown>,
  where: Record<string, unknown>,
): boolean {
  return Object.entries(where).every(([campo, condicao]) => {
    const valor = linha[campo];
    if (condicao !== null && typeof condicao === 'object') {
      const filtro = condicao as { not?: unknown; gt?: number };
      if ('not' in filtro) {
        return valor !== filtro.not;
      }
      if ('gt' in filtro) {
        return typeof valor === 'number' && valor > (filtro.gt as number);
      }
      throw new Error(`Filtro não suportado pelo fake: ${campo}`);
    }
    return valor === condicao;
  });
}

function novaDevolucao(extras: Partial<DevolucaoFake> = {}): DevolucaoFake {
  return {
    id: 1,
    pedidoId: 10,
    usuarioId: 1,
    status: StatusDevolucao.EM_CONFERENCIA,
    motivo: 'Chegou quebrada',
    descricao: null,
    solicitadaEm: new Date('2026-09-29T12:00:00Z'),
    analisadaEm: new Date('2026-09-30T12:00:00Z'),
    observacaoAnalise: null,
    analisadoPorId: ADMIN_ID,
    recebidaEm: new Date('2026-10-05T12:00:00Z'),
    conferidaEm: null,
    conferidoPorId: null,
    observacaoConferencia: null,
    reembolsoValor: null,
    asaasRefundId: null,
    reembolsadaEm: null,
    estoqueRestauradoEm: null,
    ...extras,
  };
}

// Deixa as outras promessas em voo andarem (simula a latência da rede).
const tick = () => new Promise((resolve) => setImmediate(resolve));

// Quantidades aceitas dos dois itens da devolução 1 (itens 100 e 200).
const aceitar = (item100: number, item200: number) => [
  { itemPedidoId: 100, quantidadeAceita: item100 },
  { itemPedidoId: 200, quantidadeAceita: item200 },
];

describe('DevolucoesService — conferência e reembolso (Etapa 9.1)', () => {
  let service: DevolucoesService;
  let estado: Estado;
  let fila: Promise<unknown>;
  let falharEstoque: boolean;
  let prisma: Record<string, unknown>;
  let mail: { enviarEmail: jest.Mock };

  // "Asaas" em memória.
  let estornos: AsaasRefund[];
  let statusAoCriar: AsaasRefund['status'];
  // Erro lançado pela criação do estorno; com `criaMesmoFalhando`, o Asaas
  // processa o estorno e só a resposta se perde (timeout).
  let falhaAoCriar: Error | null;
  let criaMesmoFalhando: boolean;
  let asaas: {
    resolverPaymentIdPorCheckout: jest.Mock;
    consultarEstornos: jest.Mock;
    estornarPagamento: jest.Mock;
  };

  const devolucao = (id = 1) =>
    estado.devolucoes.find((item) => item.id === id)!;
  const itensDa = (id = 1) =>
    estado.itens.filter((item) => item.devolucaoId === id);

  beforeEach(async () => {
    estado = {
      pedido: {
        id: 10,
        numero: 'PED-10',
        data: new Date('2026-09-20T12:00:00Z'),
        status: StatusPedido.PAGO,
        statusEnvio: StatusEnvio.ENVIADO,
        enviadoEm: new Date('2026-09-21T12:00:00Z'),
        // 3 x 50,00 + 1 x 39,90 + frete 25,00.
        total: 214.9,
        asaasPaymentId: 'pay_1',
        asaasCheckoutId: 'chk_1',
        clienteNome: 'Cliente',
        clienteEmail: 'cliente@sensora.dev',
      },
      devolucoes: [novaDevolucao()],
      itens: [
        {
          id: 1,
          devolucaoId: 1,
          itemPedidoId: 100,
          quantidade: 3,
          precoUnitario: 50,
          quantidadeAceita: null,
        },
        {
          id: 2,
          devolucaoId: 1,
          itemPedidoId: 200,
          quantidade: 1,
          precoUnitario: 39.9,
          quantidadeAceita: null,
        },
      ],
      itensPedido: {
        100: { produtoId: 1, estoqueBaixado: true, quantidade: 3 },
        200: { produtoId: 2, estoqueBaixado: true, quantidade: 1 },
        300: { produtoId: 3, estoqueBaixado: true, quantidade: 1 },
      },
      estoque: { 1: 10, 2: 5, 3: 0 },
    };
    fila = Promise.resolve();
    falharEstoque = false;
    estornos = [];
    statusAoCriar = 'DONE';
    falhaAoCriar = null;
    criaMesmoFalhando = false;

    const completa = (linha: DevolucaoFake) => ({
      ...linha,
      pedido: { ...estado.pedido },
      usuario: { nome: 'Cliente', email: 'cliente@sensora.dev' },
      analisadoPor: null,
      conferidoPor: null,
      itens: estado.itens
        .filter((item) => item.devolucaoId === linha.id)
        .map((item) => ({
          ...item,
          itemPedido: {
            ...estado.itensPedido[item.itemPedidoId],
            produto: { nome: 'Vela' },
          },
        })),
      evidencias: [],
      envio: null,
    });
    const buscar = ({ where }: { where: { id: number } }) => {
      const linha = estado.devolucoes.find((item) => item.id === where.id);
      return linha ? completa(linha) : null;
    };

    prisma = {
      devolucao: {
        findUnique: jest.fn(buscar),
        findUniqueOrThrow: jest.fn((args: { where: { id: number } }) => {
          const linha = buscar(args);
          if (!linha) {
            throw new Error('Registro não encontrado');
          }
          return linha;
        }),
        findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
          estado.devolucoes
            .filter((linha) => bate(linha, where))
            .map((linha) => ({ ...linha })),
        ),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: Record<string, unknown>;
            data: Partial<DevolucaoFake>;
          }) => {
            const alvos = estado.devolucoes.filter((linha) =>
              bate(linha, where),
            );
            alvos.forEach((linha) => Object.assign(linha, data));
            return { count: alvos.length };
          },
        ),
        update: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: number };
            data: Partial<DevolucaoFake>;
          }) => Object.assign(devolucao(where.id), data),
        ),
        aggregate: jest.fn(({ where }: { where: Record<string, unknown> }) => {
          const linhas = estado.devolucoes.filter((linha) =>
            bate(linha, where),
          );
          return {
            _sum: {
              reembolsoValor: linhas.length
                ? linhas.reduce(
                    (soma, linha) => soma + (linha.reembolsoValor ?? 0),
                    0,
                  )
                : null,
            },
          };
        }),
      },
      itemDevolucao: {
        update: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: number };
            data: Partial<ItemFake>;
          }) =>
            Object.assign(
              estado.itens.find((item) => item.id === where.id)!,
              data,
            ),
        ),
      },
      produto: {
        update: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: number };
            data: { quantidade: { increment: number } };
          }) => {
            if (falharEstoque) {
              throw new Error('Falha simulada ao devolver o estoque');
            }
            estado.estoque[where.id] += data.quantidade.increment;
            return {};
          },
        ),
      },
      pedido: {
        update: jest.fn(
          ({ data }: { data: Partial<Estado['pedido']> }) =>
            Object.assign(estado.pedido, data),
        ),
      },
      $queryRaw: jest.fn(() => Promise.resolve([])),
      $transaction: jest.fn(
        (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
          const execucao = fila.then(async () => {
            const antes = structuredClone(estado);
            try {
              return await fn(prisma);
            } catch (erro) {
              estado = antes;
              throw erro;
            }
          });
          fila = execucao.catch(() => undefined);
          return execucao;
        },
      ),
    };

    asaas = {
      resolverPaymentIdPorCheckout: jest.fn(() =>
        Promise.resolve({ encontrado: false }),
      ),
      consultarEstornos: jest.fn(() =>
        Promise.resolve(estornos.map((estorno) => ({ ...estorno }))),
      ),
      estornarPagamento: jest.fn(
        async (_paymentId: string, description: string, value: number) => {
          await tick();
          if (falhaAoCriar && !criaMesmoFalhando) {
            throw falhaAoCriar;
          }
          const novo: AsaasRefund = {
            id: `ref_${estornos.length + 1}`,
            status: statusAoCriar,
            value,
            description,
          };
          estornos.push(novo);
          if (falhaAoCriar) {
            throw falhaAoCriar;
          }
          return { ...novo };
        },
      ),
    };
    mail = { enviarEmail: jest.fn(() => Promise.resolve()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevolucoesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ImagekitService, useValue: {} },
        { provide: MailService, useValue: mail },
        { provide: MelhorEnvioService, useValue: {} },
        { provide: AsaasService, useValue: asaas },
      ],
    }).compile();

    service = module.get(DevolucoesService);
  });

  describe('iniciarConferencia', () => {
    beforeEach(() => {
      devolucao().status = StatusDevolucao.RECEBIDA;
    });

    it('RECEBIDA -> EM_CONFERENCIA', async () => {
      const resultado = await service.iniciarConferencia(1);

      expect(resultado.status).toBe(StatusDevolucao.EM_CONFERENCIA);
      expect(devolucao().status).toBe(StatusDevolucao.EM_CONFERENCIA);
      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
    });

    it('dois ADMINs ao mesmo tempo: só um inicia, o outro recebe 409', async () => {
      const resultados = await Promise.allSettled([
        service.iniciarConferencia(1),
        service.iniciarConferencia(1),
      ]);

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
      const recusado = resultados.find((r) => r.status === 'rejected');
      expect((recusado as PromiseRejectedResult).reason).toBeInstanceOf(
        ConflictException,
      );
    });

    it.each(
      Object.values(StatusDevolucao).filter(
        (status) => status !== StatusDevolucao.RECEBIDA,
      ),
    )('status %s: 409, nada muda', async (status) => {
      devolucao().status = status;

      await expect(service.iniciarConferencia(1)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(devolucao().status).toBe(status);
    });

    it('devolução inexistente: 404', async () => {
      await expect(service.iniciarConferencia(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('concluirConferencia — quantidades', () => {
    it('tudo aceito: reembolsa o valor dos itens, devolve o estoque e conclui', async () => {
      const resultado = await service.concluirConferencia(
        1,
        ADMIN_ID,
        aceitar(3, 1),
      );

      expect(resultado.status).toBe(StatusDevolucao.CONCLUIDA);
      expect(resultado.reembolsoValor).toBe(189.9);
      expect(resultado.reembolsadaEm).toBeInstanceOf(Date);
      expect(resultado.estoqueRestauradoEm).toBeInstanceOf(Date);
      expect(resultado.itens.map((item) => item.quantidadeAceita)).toEqual([
        3, 1,
      ]);
      expect(devolucao().conferidoPorId).toBe(ADMIN_ID);
      expect(devolucao().conferidaEm).toBeInstanceOf(Date);
      expect(devolucao().asaasRefundId).toBe('ref_1');

      // Valor calculado no backend: 3 x 50,00 + 1 x 39,90 (sem o frete).
      expect(asaas.estornarPagamento).toHaveBeenCalledTimes(1);
      expect(asaas.estornarPagamento).toHaveBeenCalledWith(
        'pay_1',
        'Devolução #1',
        189.9,
      );
      expect(estado.estoque).toEqual({ 1: 13, 2: 6, 3: 0 });
      // O pedido não muda: continua PAGO, com o total original.
      expect(estado.pedido.status).toBe(StatusPedido.PAGO);
      expect(estado.pedido.total).toBe(214.9);
    });

    it('aceite parcial (2 de 3 e 0 de 1): reembolsa e devolve ao estoque só o aceito', async () => {
      const resultado = await service.concluirConferencia(
        1,
        ADMIN_ID,
        aceitar(2, 0),
        '  Uma vela usada e a outra sem embalagem  ',
      );

      expect(resultado.status).toBe(StatusDevolucao.CONCLUIDA);
      expect(resultado.reembolsoValor).toBe(100);
      expect(resultado.observacaoConferencia).toBe(
        'Uma vela usada e a outra sem embalagem',
      );
      expect(asaas.estornarPagamento).toHaveBeenCalledWith(
        'pay_1',
        'Devolução #1',
        100,
      );
      // +2 (e não +3) no produto 1; nada no produto 2.
      expect(estado.estoque).toEqual({ 1: 12, 2: 5, 3: 0 });
      expect(itensDa().map((item) => item.quantidadeAceita)).toEqual([2, 0]);
    });

    it('aceite parcial sem observação: 400, nada é gravado', async () => {
      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(2, 1)),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(devolucao().conferidaEm).toBeNull();
      expect(itensDa().map((item) => item.quantidadeAceita)).toEqual([
        null,
        null,
      ]);
      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
    });

    it('nada aceito: CONCLUIDA com reembolso 0, sem Asaas e sem estoque', async () => {
      const resultado = await service.concluirConferencia(
        1,
        ADMIN_ID,
        aceitar(0, 0),
        'Produtos usados',
      );

      expect(resultado.status).toBe(StatusDevolucao.CONCLUIDA);
      expect(resultado.reembolsoValor).toBe(0);
      expect(resultado.reembolsadaEm).toBeNull();
      expect(resultado.estoqueRestauradoEm).toBeNull();
      expect(asaas.consultarEstornos).not.toHaveBeenCalled();
      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
      expect(estado.estoque).toEqual({ 1: 10, 2: 5, 3: 0 });
      expect(mail.enviarEmail).toHaveBeenCalledTimes(1);
    });

    it('nada aceito conclui mesmo com o pedido já reembolsado', async () => {
      estado.pedido.status = StatusPedido.REEMBOLSADO;

      const resultado = await service.concluirConferencia(
        1,
        ADMIN_ID,
        aceitar(0, 0),
        'Produtos usados',
      );

      expect(resultado.status).toBe(StatusDevolucao.CONCLUIDA);
    });

    it.each([
      ['maior que a devolvida', aceitar(4, 1)],
      ['negativa', aceitar(-1, 1)],
      ['decimal', aceitar(1.5, 1)],
      ['item faltando', [{ itemPedidoId: 100, quantidadeAceita: 3 }]],
      [
        'item que não é da devolução',
        [...aceitar(3, 1), { itemPedidoId: 300, quantidadeAceita: 1 }],
      ],
      [
        'item repetido',
        [
          { itemPedidoId: 100, quantidadeAceita: 1 },
          { itemPedidoId: 100, quantidadeAceita: 2 },
        ],
      ],
    ])('quantidade aceita %s: 400, nada é gravado', async (_caso, itens) => {
      await expect(
        service.concluirConferencia(1, ADMIN_ID, itens, 'obs'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(devolucao().status).toBe(StatusDevolucao.EM_CONFERENCIA);
      expect(devolucao().conferidaEm).toBeNull();
      expect(devolucao().reembolsoValor).toBeNull();
      expect(itensDa().map((item) => item.quantidadeAceita)).toEqual([
        null,
        null,
      ]);
      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
      expect(estado.estoque).toEqual({ 1: 10, 2: 5, 3: 0 });
    });

    it.each(
      Object.values(StatusDevolucao).filter(
        (status) => status !== StatusDevolucao.EM_CONFERENCIA,
      ),
    )('status %s: 409, nada é feito', async (status) => {
      devolucao().status = status;

      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(devolucao().conferidaEm).toBeNull();
      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
    });

    it('devolução inexistente: 404', async () => {
      await expect(
        service.concluirConferencia(999, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('pedido que não está PAGO: 409, conferência não é gravada', async () => {
      estado.pedido.status = StatusPedido.REEMBOLSO_SOLICITADO;

      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(devolucao().conferidaEm).toBeNull();
      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
    });
  });

  describe('reembolso — idempotência e concorrência', () => {
    it('conferência já registrada: concluir de novo é 409 e não gera outro estorno', async () => {
      await service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1));

      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(service.reprocessarReembolso(1)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(asaas.estornarPagamento).toHaveBeenCalledTimes(1);
      expect(estornos).toHaveLength(1);
      expect(estado.estoque).toEqual({ 1: 13, 2: 6, 3: 0 });
    });

    it('dois ADMINs concluem ao mesmo tempo: uma conferência, um estorno, estoque uma vez', async () => {
      const resultados = await Promise.allSettled([
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
        service.concluirConferencia(1, ADMIN_ID + 1, aceitar(1, 1), 'obs'),
      ]);

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
      expect(asaas.estornarPagamento).toHaveBeenCalledTimes(1);
      expect(estornos).toHaveLength(1);
      expect(devolucao().conferidoPorId).toBe(ADMIN_ID);
      expect(estado.estoque).toEqual({ 1: 13, 2: 6, 3: 0 });
      expect(mail.enviarEmail).toHaveBeenCalledTimes(1);
    });

    it('dois reprocessamentos ao mesmo tempo: um único estorno', async () => {
      falhaAoCriar = new AsaasErroHttpError('Asaas recusou');
      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(AsaasErroHttpError);
      falhaAoCriar = null;
      asaas.estornarPagamento.mockClear();

      const resultados = await Promise.allSettled([
        service.reprocessarReembolso(1),
        service.reprocessarReembolso(1),
      ]);

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
      expect(asaas.estornarPagamento).toHaveBeenCalledTimes(1);
      expect(estornos).toHaveLength(1);
      expect(devolucao().status).toBe(StatusDevolucao.CONCLUIDA);
      expect(estado.estoque).toEqual({ 1: 13, 2: 6, 3: 0 });
    });

    it('Asaas recusa o estorno: conferência fica gravada, sem reembolso e sem estoque; reprocessar conclui', async () => {
      falhaAoCriar = new AsaasErroHttpError('Asaas recusou');

      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(AsaasErroHttpError);

      expect(devolucao().status).toBe(StatusDevolucao.EM_CONFERENCIA);
      // (a cópia do rollback do fake vem de outro contexto: sem instanceof)
      expect(devolucao().conferidaEm).not.toBeNull();
      expect(devolucao().reembolsoValor).toBe(189.9);
      expect(devolucao().asaasRefundId).toBeNull();
      expect(devolucao().reembolsadaEm).toBeNull();
      expect(estado.estoque).toEqual({ 1: 10, 2: 5, 3: 0 });
      expect(mail.enviarEmail).not.toHaveBeenCalled();

      falhaAoCriar = null;
      const resultado = await service.reprocessarReembolso(1);

      expect(resultado.status).toBe(StatusDevolucao.CONCLUIDA);
      expect(estornos).toHaveLength(1);
      expect(estado.estoque).toEqual({ 1: 13, 2: 6, 3: 0 });
    });

    it('timeout depois de o Asaas ter criado o estorno: reprocessar reaproveita o estorno, sem pedir outro', async () => {
      falhaAoCriar = new AsaasIndisponivelError('timeout');
      criaMesmoFalhando = true;

      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(AsaasIndisponivelError);
      expect(estornos).toHaveLength(1);
      expect(devolucao().status).toBe(StatusDevolucao.EM_CONFERENCIA);
      expect(estado.estoque).toEqual({ 1: 10, 2: 5, 3: 0 });

      falhaAoCriar = null;
      asaas.estornarPagamento.mockClear();
      const resultado = await service.reprocessarReembolso(1);

      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
      expect(estornos).toHaveLength(1);
      expect(resultado.status).toBe(StatusDevolucao.CONCLUIDA);
      expect(devolucao().asaasRefundId).toBe('ref_1');
      expect(estado.estoque).toEqual({ 1: 13, 2: 6, 3: 0 });
    });

    it('estorno no Asaas que não é de nenhuma devolução: 409, nenhum estorno novo', async () => {
      estornos.push({
        id: 'ref_fora',
        status: 'DONE',
        value: 50,
        description: 'Estorno feito no painel',
      });

      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
      expect(devolucao().status).toBe(StatusDevolucao.EM_CONFERENCIA);
      expect(estado.estoque).toEqual({ 1: 10, 2: 5, 3: 0 });
    });

    it('sem asaasPaymentId: resolve pelo checkout e grava no pedido', async () => {
      estado.pedido.asaasPaymentId = null;
      asaas.resolverPaymentIdPorCheckout.mockResolvedValue({
        encontrado: true,
        payment: { id: 'pay_resolvido' },
      });

      await service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1));

      expect(asaas.resolverPaymentIdPorCheckout).toHaveBeenCalledWith('chk_1');
      expect(estado.pedido.asaasPaymentId).toBe('pay_resolvido');
      expect(asaas.estornarPagamento).toHaveBeenCalledWith(
        'pay_resolvido',
        'Devolução #1',
        189.9,
      );
    });

    it('pagamento não localizado no Asaas: 409, sem estorno', async () => {
      estado.pedido.asaasPaymentId = null;

      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
      expect(devolucao().status).toBe(StatusDevolucao.EM_CONFERENCIA);
    });

    it('pedido deixa de estar PAGO depois da conferência: reprocessar não cria estorno', async () => {
      falhaAoCriar = new AsaasErroHttpError('Asaas recusou');
      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(AsaasErroHttpError);
      falhaAoCriar = null;
      asaas.estornarPagamento.mockClear();
      estado.pedido.status = StatusPedido.REEMBOLSO_SOLICITADO;

      await expect(service.reprocessarReembolso(1)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
    });

    it('falha no e-mail não desfaz a conclusão', async () => {
      mail.enviarEmail.mockRejectedValue(new Error('Resend fora do ar'));

      const resultado = await service.concluirConferencia(
        1,
        ADMIN_ID,
        aceitar(3, 1),
      );

      expect(resultado.status).toBe(StatusDevolucao.CONCLUIDA);
    });
  });

  describe('reembolso em processamento e webhooks (confirmarReembolsosDoPedido)', () => {
    it('estorno PENDING: fica EM_CONFERENCIA, sem estoque; o webhook conclui quando o Asaas confirma', async () => {
      statusAoCriar = 'PENDING';

      const resultado = await service.concluirConferencia(
        1,
        ADMIN_ID,
        aceitar(2, 1),
        'Uma vela usada',
      );

      expect(resultado.status).toBe(StatusDevolucao.EM_CONFERENCIA);
      expect(resultado.reembolsoValor).toBe(139.9);
      expect(resultado.reembolsadaEm).toBeNull();
      expect(devolucao().asaasRefundId).toBe('ref_1');
      expect(estado.estoque).toEqual({ 1: 10, 2: 5, 3: 0 });
      expect(mail.enviarEmail).not.toHaveBeenCalled();

      // Webhook de "em processamento": o estorno ainda não está DONE.
      expect(await service.confirmarReembolsosDoPedido(10)).toBe(0);
      expect(devolucao().status).toBe(StatusDevolucao.EM_CONFERENCIA);
      expect(estado.estoque).toEqual({ 1: 10, 2: 5, 3: 0 });

      // O Asaas confirma o estorno.
      estornos[0].status = 'DONE';
      expect(await service.confirmarReembolsosDoPedido(10)).toBe(139.9);

      expect(devolucao().status).toBe(StatusDevolucao.CONCLUIDA);
      expect(devolucao().reembolsadaEm).toBeInstanceOf(Date);
      expect(estado.estoque).toEqual({ 1: 12, 2: 6, 3: 0 });
      expect(mail.enviarEmail).toHaveBeenCalledTimes(1);
      // O webhook nunca cria estorno.
      expect(asaas.estornarPagamento).toHaveBeenCalledTimes(1);
      // E não mexe no pedido.
      expect(estado.pedido.status).toBe(StatusPedido.PAGO);
    });

    it('webhook duplicado: não devolve o estoque de novo nem avisa de novo', async () => {
      statusAoCriar = 'PENDING';
      await service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1));
      estornos[0].status = 'DONE';

      await service.confirmarReembolsosDoPedido(10);
      asaas.consultarEstornos.mockClear();
      expect(await service.confirmarReembolsosDoPedido(10)).toBe(189.9);
      expect(await service.confirmarReembolsosDoPedido(10)).toBe(189.9);

      expect(asaas.consultarEstornos).not.toHaveBeenCalled();
      expect(estado.estoque).toEqual({ 1: 13, 2: 6, 3: 0 });
      expect(mail.enviarEmail).toHaveBeenCalledTimes(1);
    });

    it('dois webhooks ao mesmo tempo: estoque devolvido uma única vez', async () => {
      statusAoCriar = 'PENDING';
      await service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1));
      estornos[0].status = 'DONE';

      await Promise.all([
        service.confirmarReembolsosDoPedido(10),
        service.confirmarReembolsosDoPedido(10),
      ]);

      expect(estado.estoque).toEqual({ 1: 13, 2: 6, 3: 0 });
      expect(mail.enviarEmail).toHaveBeenCalledTimes(1);
    });

    it('webhook fora de ordem (antes da conferência): nada é consultado nem alterado', async () => {
      expect(await service.confirmarReembolsosDoPedido(10)).toBe(0);

      expect(asaas.consultarEstornos).not.toHaveBeenCalled();
      expect(devolucao().status).toBe(StatusDevolucao.EM_CONFERENCIA);
      expect(estado.estoque).toEqual({ 1: 10, 2: 5, 3: 0 });
    });

    it('webhook com a conferência gravada mas sem estorno pedido: não cria estorno', async () => {
      falhaAoCriar = new AsaasErroHttpError('Asaas recusou');
      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(AsaasErroHttpError);
      falhaAoCriar = null;
      asaas.estornarPagamento.mockClear();

      expect(await service.confirmarReembolsosDoPedido(10)).toBe(0);

      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
      expect(devolucao().status).toBe(StatusDevolucao.EM_CONFERENCIA);
    });

    it('estorno negado/cancelado pelo Asaas: não conclui, libera um novo pedido de estorno', async () => {
      statusAoCriar = 'PENDING';
      await service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1));
      estornos[0].status = 'CANCELLED';

      expect(await service.confirmarReembolsosDoPedido(10)).toBe(0);

      expect(devolucao().status).toBe(StatusDevolucao.EM_CONFERENCIA);
      expect(devolucao().asaasRefundId).toBeNull();
      expect(devolucao().reembolsadaEm).toBeNull();
      expect(estado.estoque).toEqual({ 1: 10, 2: 5, 3: 0 });

      statusAoCriar = 'DONE';
      const resultado = await service.reprocessarReembolso(1);

      expect(resultado.status).toBe(StatusDevolucao.CONCLUIDA);
      expect(devolucao().asaasRefundId).toBe('ref_2');
      expect(estornos.filter((e) => e.status !== 'CANCELLED')).toHaveLength(1);
      expect(estado.estoque).toEqual({ 1: 13, 2: 6, 3: 0 });
    });
  });

  describe('estoque', () => {
    it('falha ao devolver o estoque: nada fica pela metade; a nova tentativa conclui sem duplicar', async () => {
      falharEstoque = true;

      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toThrow('Falha simulada ao devolver o estoque');

      // O estorno existe no Asaas, mas a devolução não foi dada como concluída.
      expect(estornos).toHaveLength(1);
      expect(devolucao().status).toBe(StatusDevolucao.EM_CONFERENCIA);
      expect(devolucao().reembolsadaEm).toBeNull();
      expect(devolucao().estoqueRestauradoEm).toBeNull();
      expect(estado.estoque).toEqual({ 1: 10, 2: 5, 3: 0 });

      falharEstoque = false;
      asaas.estornarPagamento.mockClear();
      await service.reprocessarReembolso(1);

      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
      expect(devolucao().status).toBe(StatusDevolucao.CONCLUIDA);
      expect(estado.estoque).toEqual({ 1: 13, 2: 6, 3: 0 });
    });

    it('item sem baixa de estoque registrada na compra: conclui sem devolver esse item', async () => {
      estado.itensPedido[200].estoqueBaixado = null;

      const resultado = await service.concluirConferencia(
        1,
        ADMIN_ID,
        aceitar(3, 1),
      );

      expect(resultado.status).toBe(StatusDevolucao.CONCLUIDA);
      expect(estado.estoque).toEqual({ 1: 13, 2: 5, 3: 0 });
    });
  });

  describe('várias devoluções no mesmo pedido', () => {
    beforeEach(() => {
      estado.devolucoes.push(novaDevolucao({ id: 2 }));
      estado.itens.push({
        id: 3,
        devolucaoId: 2,
        itemPedidoId: 300,
        quantidade: 1,
        precoUnitario: 20,
        quantidadeAceita: null,
      });
    });

    it('cada devolução tem o seu estorno; o total confirmado é a soma', async () => {
      await service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1));
      await service.concluirConferencia(2, ADMIN_ID, [
        { itemPedidoId: 300, quantidadeAceita: 1 },
      ]);

      expect(estornos.map((e) => [e.description, e.value])).toEqual([
        ['Devolução #1', 189.9],
        ['Devolução #2', 20],
      ]);
      expect(devolucao(1).asaasRefundId).toBe('ref_1');
      expect(devolucao(2).asaasRefundId).toBe('ref_2');
      expect(await service.confirmarReembolsosDoPedido(10)).toBe(209.9);
      expect(estado.estoque).toEqual({ 1: 13, 2: 6, 3: 1 });
    });

    it('soma das devoluções passaria do total do pedido: 409, conferência não é gravada', async () => {
      // 189,90 + 30,00 = 219,90 > 214,90.
      estado.itens[2].precoUnitario = 30;
      await service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1));
      asaas.estornarPagamento.mockClear();

      await expect(
        service.concluirConferencia(2, ADMIN_ID, [
          { itemPedidoId: 300, quantidadeAceita: 1 },
        ]),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(devolucao(2).conferidaEm).toBeNull();
      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
      expect(estornos).toHaveLength(1);
    });

    it('estornos já feitos no Asaas + este passariam do total: 409, sem estorno novo', async () => {
      // O Asaas já tem um estorno da devolução 2 que o banco não registrou.
      estornos.push({
        id: 'ref_dev2',
        status: 'DONE',
        value: 100,
        description: 'Devolução #2',
      });

      await expect(
        service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1)),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(asaas.estornarPagamento).not.toHaveBeenCalled();
      expect(devolucao(1).status).toBe(StatusDevolucao.EM_CONFERENCIA);
    });

    it('o estorno de uma devolução nunca é confundido com o de outra', async () => {
      statusAoCriar = 'PENDING';
      await service.concluirConferencia(1, ADMIN_ID, aceitar(3, 1));
      await service.concluirConferencia(2, ADMIN_ID, [
        { itemPedidoId: 300, quantidadeAceita: 1 },
      ]);

      // Só o estorno da devolução 2 é confirmado.
      estornos[1].status = 'DONE';
      expect(await service.confirmarReembolsosDoPedido(10)).toBe(20);

      expect(devolucao(1).status).toBe(StatusDevolucao.EM_CONFERENCIA);
      expect(devolucao(2).status).toBe(StatusDevolucao.CONCLUIDA);
      expect(estado.estoque).toEqual({ 1: 10, 2: 5, 3: 1 });
    });
  });
});
