import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListarOcorrenciasQueryDto } from './dto/listar-ocorrencias.dto';
import { DetalhesOcorrencia } from './entities/ocorrencia.entity';
import { ResultadoOcorrencia } from './enums/resultado-ocorrencia.enum';
import { TipoOcorrencia } from './enums/tipo-ocorrencia.enum';
import {
  OcorrenciasService,
  RegistrarOcorrenciaInput,
} from './ocorrencias.service';

const DIA = 24 * 60 * 60 * 1000;

type Registro = Record<string, unknown> & {
  id: number;
  criadoEm: Date;
  chaveIdempotencia: string | null;
};

const BASE: RegistrarOcorrenciaInput = {
  tipo: TipoOcorrencia.REEMBOLSO,
  resultado: ResultadoOcorrencia.FALHA,
  codigo: 'ASAAS_RECUSOU_ESTORNO',
  etapa: 'solicitarReembolso',
  mensagem: 'O Asaas recusou o estorno: saldo insuficiente.',
};

function erroP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`chaveIdempotencia`)',
    { code: 'P2002', clientVersion: 'test' },
  );
}

describe('OcorrenciasService', () => {
  let service: OcorrenciasService;
  let registros: Registro[];
  let prisma: {
    ocorrencia: {
      create: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    registros = [];
    prisma = {
      ocorrencia: {
        // Imita o banco: chaveIdempotencia @unique (P2002) e id/criadoEm.
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          const chave = (data.chaveIdempotencia as string | null) ?? null;
          if (chave && registros.some((r) => r.chaveIdempotencia === chave)) {
            return Promise.reject(erroP2002());
          }
          const registro: Registro = {
            ...data,
            id: registros.length + 1,
            criadoEm: new Date(),
            chaveIdempotencia: chave,
          };
          registros.push(registro);
          return Promise.resolve(registro);
        }),
        deleteMany: jest.fn(
          ({ where }: { where: { criadoEm: { lt: Date } } }) => {
            const antes = registros.length;
            registros = registros.filter(
              (r) => r.criadoEm >= where.criadoEm.lt,
            );
            return Promise.resolve({ count: antes - registros.length });
          },
        ),
        findMany: jest.fn(() => Promise.resolve([])),
        count: jest.fn(() => Promise.resolve(0)),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        OcorrenciasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(OcorrenciasService);
  });

  function dadosGravados(indice = 0): Record<string, unknown> {
    const [{ data }] = prisma.ocorrencia.create.mock.calls[indice] as [
      { data: Record<string, unknown> },
    ];
    return data;
  }

  describe('registrar', () => {
    it('registra uma ocorrência completa e devolve CRIADA', async () => {
      const resultado = await service.registrar({
        ...BASE,
        usuarioId: 12,
        pedidoId: 73,
        devolucaoId: 5,
        pedidoNumero: 'PED-1791301388814',
        valor: 16.65,
        gateway: 'asaas',
        referenciaExterna: 'pay_2sc7r40p8o26gr83',
        detalhes: {
          asaasCode: 'invalid_action',
          asaasDescription: 'Saldo insuficiente.',
        },
      });

      expect(resultado).toBe('CRIADA');
      expect(dadosGravados()).toEqual({
        tipo: 'REEMBOLSO',
        resultado: 'FALHA',
        codigo: 'ASAAS_RECUSOU_ESTORNO',
        etapa: 'solicitarReembolso',
        mensagem: 'O Asaas recusou o estorno: saldo insuficiente.',
        usuarioId: 12,
        pedidoId: 73,
        devolucaoId: 5,
        pedidoNumero: 'PED-1791301388814',
        valor: 16.65,
        gateway: 'asaas',
        referenciaExterna: 'pay_2sc7r40p8o26gr83',
        detalhes: {
          asaasCode: 'invalid_action',
          asaasDescription: 'Saldo insuficiente.',
        },
        chaveIdempotencia: null,
      });
    });

    it('funciona só com os campos obrigatórios (opcionais viram null, sem detalhes)', async () => {
      expect(await service.registrar(BASE)).toBe('CRIADA');

      const dados = dadosGravados();
      expect(dados).toMatchObject({
        usuarioId: null,
        pedidoId: null,
        devolucaoId: null,
        pedidoNumero: null,
        valor: null,
        gateway: null,
        referenciaExterna: null,
        chaveIdempotencia: null,
      });
      expect(dados).not.toHaveProperty('detalhes');
    });

    it.each([
      ['usuarioId', { pedidoId: 1, devolucaoId: 2 }],
      ['pedidoId', { usuarioId: 1, devolucaoId: 2 }],
      ['devolucaoId', { usuarioId: 1, pedidoId: 2 }],
    ])('funciona sem %s', async (ausente, ids) => {
      expect(await service.registrar({ ...BASE, ...ids })).toBe('CRIADA');
      expect(dadosGravados()[ausente]).toBeNull();
    });

    it('aceita detalhes seguros e descarta chaves desconhecidas, objetos e valores inválidos', async () => {
      await service.registrar({
        ...BASE,
        detalhes: {
          produtoId: 123,
          quantidadePedida: 3,
          quantidadeDisponivel: 1,
          produtoNome: 'Vela Lavanda',
          // Fora do domínio — nunca pode chegar ao banco.
          payload: { card: '4111' },
          token: 'abc',
          senha: 'x',
          quantidadeDevolvida: Number.NaN,
          unidadesDevolvidas: Number.POSITIVE_INFINITY,
        } as unknown as DetalhesOcorrencia,
      });

      expect(dadosGravados().detalhes).toEqual({
        produtoId: 123,
        quantidadePedida: 3,
        quantidadeDisponivel: 1,
        produtoNome: 'Vela Lavanda',
      });
    });

    it('detalhes só com chaves desconhecidas não grava detalhes', async () => {
      await service.registrar({
        ...BASE,
        detalhes: { payloadBruto: '{...}' } as unknown as DetalhesOcorrencia,
      });

      expect(dadosGravados()).not.toHaveProperty('detalhes');
    });

    it('trunca textos longos (mensagem em 500, demais campos em 200)', async () => {
      await service.registrar({
        ...BASE,
        mensagem: 'm'.repeat(800),
        codigo: 'c'.repeat(300),
        detalhes: { asaasDescription: 'd'.repeat(300) },
      });

      const dados = dadosGravados();
      expect((dados.mensagem as string).length).toBe(500);
      expect((dados.codigo as string).length).toBe(200);
      expect(
        (dados.detalhes as { asaasDescription: string }).asaasDescription
          .length,
      ).toBe(200);
    });

    it('falha interna do Prisma não propaga exceção (devolve FALHOU)', async () => {
      prisma.ocorrencia.create.mockRejectedValueOnce(new Error('banco fora'));

      await expect(service.registrar(BASE)).resolves.toBe('FALHOU');
    });

    it('conflito de chaveIdempotencia não derruba o fluxo (devolve DUPLICADA)', async () => {
      prisma.ocorrencia.create.mockRejectedValueOnce(erroP2002());

      await expect(
        service.registrar({
          ...BASE,
          chaveIdempotencia: 'REFUND_DENIED:pay_1',
        }),
      ).resolves.toBe('DUPLICADA');
    });

    it('mesma chave não cria duplicata', async () => {
      const comChave = { ...BASE, chaveIdempotencia: 'REFUND_DENIED:pay_1' };

      expect(await service.registrar(comChave)).toBe('CRIADA');
      expect(await service.registrar(comChave)).toBe('DUPLICADA');
      expect(registros).toHaveLength(1);
    });

    it('sem chave, duas tentativas legítimas geram duas ocorrências', async () => {
      await service.registrar(BASE);
      await service.registrar(BASE);

      expect(registros).toHaveLength(2);
      expect(registros.every((r) => r.chaveIdempotencia === null)).toBe(true);
    });
  });

  describe('retenção (30 dias)', () => {
    it('remove as anteriores a 30 dias e mantém as mais recentes', async () => {
      registros = [
        {
          id: 1,
          criadoEm: new Date(Date.now() - 31 * DIA),
          chaveIdempotencia: null,
        },
        {
          id: 2,
          criadoEm: new Date(Date.now() - 29 * DIA),
          chaveIdempotencia: null,
        },
        { id: 3, criadoEm: new Date(), chaveIdempotencia: null },
      ];

      await service.removerAntigas();

      expect(registros.map((r) => r.id)).toEqual([2, 3]);
      const [[{ where }]] = prisma.ocorrencia.deleteMany.mock.calls as [
        [{ where: { criadoEm: { lt: Date } } }],
      ];
      const limiteMs = Date.now() - where.criadoEm.lt.getTime();
      expect(limiteMs).toBeGreaterThanOrEqual(30 * DIA);
      expect(limiteMs).toBeLessThan(30 * DIA + 5000);
    });

    it('falha na limpeza não lança', async () => {
      prisma.ocorrencia.deleteMany.mockRejectedValueOnce(
        new Error('banco fora'),
      );

      await expect(service.removerAntigas()).resolves.toBeUndefined();
    });

    it('subir o módulo com a limpeza falhando não derruba nada, e o timer é encerrado', async () => {
      prisma.ocorrencia.deleteMany.mockRejectedValue(new Error('banco fora'));

      expect(() => service.onModuleInit()).not.toThrow();
      await new Promise((resolver) => setImmediate(resolver));
      expect(prisma.ocorrencia.deleteMany).toHaveBeenCalledTimes(1);
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  describe('listar', () => {
    function consulta(
      filtros: Partial<ListarOcorrenciasQueryDto> = {},
    ): ListarOcorrenciasQueryDto {
      return Object.assign(new ListarOcorrenciasQueryDto(), filtros);
    }

    function argsFindMany(): {
      where: { criadoEm: { gte: Date; lte?: Date } } & Record<string, unknown>;
      orderBy: unknown;
      skip: number;
      take: number;
    } {
      const [[args]] = prisma.ocorrencia.findMany.mock.calls as [
        [ReturnType<typeof argsFindMany>],
      ];
      return args;
    }

    it('padrão: página 1, 20 por página, ordenado por criadoEm DESC, só os últimos 30 dias', async () => {
      await service.listar(consulta());

      const args = argsFindMany();
      expect(args.skip).toBe(0);
      expect(args.take).toBe(20);
      expect(args.orderBy).toEqual([{ criadoEm: 'desc' }, { id: 'desc' }]);
      const janela = Date.now() - args.where.criadoEm.gte.getTime();
      expect(janela).toBeGreaterThanOrEqual(30 * DIA);
      expect(janela).toBeLessThan(30 * DIA + 5000);
    });

    it('paginação calcula skip/take, total e totalPages', async () => {
      prisma.ocorrencia.count.mockResolvedValueOnce(45);

      const pagina = await service.listar(consulta({ page: 3, pageSize: 20 }));

      expect(argsFindMany().skip).toBe(40);
      expect(argsFindMany().take).toBe(20);
      expect(pagina).toMatchObject({
        page: 3,
        pageSize: 20,
        total: 45,
        totalPages: 3,
      });
    });

    it('sem resultados: total 0 e totalPages 0', async () => {
      const pagina = await service.listar(consulta());

      expect(pagina).toEqual({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it('filtros são repassados ao where (e ao count)', async () => {
      await service.listar(
        consulta({
          tipo: TipoOcorrencia.PAGAMENTO,
          resultado: ResultadoOcorrencia.ALERTA,
          codigo: 'PAGO_SEM_ESTOQUE',
          usuarioId: 12,
          pedidoId: 73,
          devolucaoId: 5,
        }),
      );

      expect(argsFindMany().where).toMatchObject({
        tipo: 'PAGAMENTO',
        resultado: 'ALERTA',
        codigo: 'PAGO_SEM_ESTOQUE',
        usuarioId: 12,
        pedidoId: 73,
        devolucaoId: 5,
      });
      const [[{ where: whereCount }]] = prisma.ocorrencia.count.mock.calls as [
        [{ where: unknown }],
      ];
      expect(whereCount).toEqual(argsFindMany().where);
    });

    it('período: dataInicio recente é usado; dataFim só com a data vai até o fim do dia', async () => {
      const inicio = new Date(Date.now() - 2 * DIA).toISOString();

      await service.listar(
        consulta({ dataInicio: inicio, dataFim: '2099-01-31' }),
      );

      expect(argsFindMany().where.criadoEm).toEqual({
        gte: new Date(inicio),
        lte: new Date('2099-01-31T23:59:59.999Z'),
      });
    });

    it('período: dataInicio anterior a 30 dias nunca expõe registros vencidos', async () => {
      await service.listar(
        consulta({ dataInicio: '2000-01-01T00:00:00.000Z' }),
      );

      const janela = Date.now() - argsFindMany().where.criadoEm.gte.getTime();
      expect(janela).toBeLessThan(30 * DIA + 5000);
    });

    it('resposta tem só os campos do modelo, com cliente resolvido e valor numérico', async () => {
      prisma.ocorrencia.findMany.mockResolvedValueOnce([
        {
          id: 1,
          criadoEm: new Date('2026-10-06T12:00:00.000Z'),
          tipo: 'REEMBOLSO',
          resultado: 'FALHA',
          codigo: 'ASAAS_RECUSOU_ESTORNO',
          etapa: 'solicitarReembolso',
          mensagem: 'Saldo insuficiente.',
          usuarioId: 12,
          pedidoId: 73,
          devolucaoId: null,
          pedidoNumero: 'PED-1',
          valor: new Prisma.Decimal('16.65'),
          gateway: 'asaas',
          referenciaExterna: 'pay_1',
          detalhes: { asaasCode: 'invalid_action' },
          chaveIdempotencia: 'REFUND:pay_1',
          // Campos que nunca podem vazar, mesmo se vierem do banco.
          usuario: {
            nome: 'Ana',
            email: 'ana@sensora.dev',
            senha: '$2b$10$hash',
          },
          tokenInterno: 'segredo',
        },
      ]);
      prisma.ocorrencia.count.mockResolvedValueOnce(1);

      const { items } = await service.listar(consulta());

      expect(items).toEqual([
        {
          id: 1,
          criadoEm: new Date('2026-10-06T12:00:00.000Z'),
          tipo: 'REEMBOLSO',
          resultado: 'FALHA',
          codigo: 'ASAAS_RECUSOU_ESTORNO',
          etapa: 'solicitarReembolso',
          mensagem: 'Saldo insuficiente.',
          usuarioId: 12,
          cliente: { nome: 'Ana', email: 'ana@sensora.dev' },
          pedidoId: 73,
          devolucaoId: null,
          pedidoNumero: 'PED-1',
          valor: 16.65,
          gateway: 'asaas',
          referenciaExterna: 'pay_1',
          detalhes: { asaasCode: 'invalid_action' },
        },
      ]);
      const json = JSON.stringify(items);
      expect(json).not.toContain('senha');
      expect(json).not.toContain('$2b$');
      expect(json).not.toContain('tokenInterno');
      expect(json).not.toContain('chaveIdempotencia');
    });

    it('a consulta pede ao banco só nome e e-mail do cliente', async () => {
      await service.listar(consulta());

      const [[args]] = prisma.ocorrencia.findMany.mock.calls as [
        [{ include: unknown }],
      ];
      expect(args.include).toEqual({
        usuario: { select: { nome: true, email: true } },
      });
    });
  });
});
