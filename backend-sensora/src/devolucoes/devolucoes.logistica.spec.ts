import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { AsaasService } from '../asaas/asaas.service';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ImagekitService } from '../imagekit/imagekit.service';
import { MailService } from '../mail/mail.service';
import {
  MelhorEnvioErroHttpError,
  MelhorEnvioIndisponivelError,
  MelhorEnvioService,
  type MelhorEnvioSituacao,
} from '../melhor-envio/melhor-envio.service';
import { StatusEnvio } from '../pedidos/enums/status-envio.enum';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { DevolucoesService } from './devolucoes.service';
import { StatusDevolucao } from './enums/status-devolucao.enum';

// Etapa 8 — logística reversa (código de devolução). Prisma MOCKADO ("banco" em memória, sempre
// devolvendo cópias, como um banco de verdade) e MelhorEnvioService
// MOCKADO (nenhuma chamada de rede). Os fakes de escrita respeitam o WHERE
// no instante da escrita e o @unique de EnvioDevolucao.devolucaoId — é o
// que os testes de concorrência exercitam.

const CLIENTE: UsuarioAutenticado = {
  id: 1,
  email: 'cliente@sensora.dev',
  perfil: PerfilUsuario.CLIENTE,
};

type EnvioFake = {
  id: number;
  devolucaoId: number;
  provedor: string;
  idExterno: string | null;
  servicoId: number;
  transportadora: string;
  servico: string;
  custo: number;
  compradaEm: Date | null;
  geradaEm: Date | null;
  codigoDevolucao: string | null;
  codigoRastreio: string | null;
  postadaEm: Date | null;
  situacaoRastreio: string | null;
  rastreioAtualizadoEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
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
  recebidaEm: Date | null;
};

const OPCOES = [
  {
    id: 1,
    transportadora: 'Correios',
    servico: 'PAC',
    preco: 25.35,
    prazoDias: 6,
  },
  {
    id: 2,
    transportadora: 'Correios',
    servico: 'SEDEX',
    preco: 41.2,
    prazoDias: 2,
  },
];

function situacao(
  extras: Partial<MelhorEnvioSituacao> = {},
): MelhorEnvioSituacao {
  return {
    status: 'pending',
    pago: false,
    gerado: false,
    postado: false,
    pagoEm: null,
    geradoEm: null,
    postadoEm: null,
    codigoDevolucao: null,
    codigoRastreio: null,
    ...extras,
  };
}

// Deixa as outras promessas em voo andarem (simula a latência da rede).
const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('DevolucoesService — logística reversa (Etapa 8)', () => {
  let service: DevolucoesService;
  let devolucao: DevolucaoFake;
  let usuario: {
    nome: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
  } | null;
  let pedido: Record<string, unknown>;
  let envios: EnvioFake[];
  let me: {
    dadosLojaFaltando: string[];
    pacoteParaQuantidade: jest.Mock;
    cotarReversa: jest.Mock;
    criarReversa: jest.Mock;
    comprarEnvio: jest.Mock;
    gerarEnvio: jest.Mock;
    urlImpressao: jest.Mock;
    consultarEnvio: jest.Mock;
  };
  // Estado do envio "no Melhor Envio", lido por consultarEnvio.
  let noMelhorEnvio: MelhorEnvioSituacao;
  let mail: { enviarEmail: jest.Mock };

  function envioAtual(): EnvioFake | undefined {
    return envios.find((e) => e.devolucaoId === devolucao.id);
  }

  function comRelacoes() {
    const envio = envioAtual();
    return {
      ...devolucao,
      pedido: { ...pedido },
      usuario: usuario ? { ...usuario } : null,
      analisadoPor: { nome: 'Admin Sensora' },
      itens: [
        {
          id: 1,
          devolucaoId: devolucao.id,
          itemPedidoId: 100,
          quantidade: 2,
          precoUnitario: 59.9,
          itemPedido: { quantidade: 3, produto: { nome: 'Vela Lavanda' } },
        },
      ],
      evidencias: [],
      envio: envio ? { ...envio } : null,
    };
  }

  // Aplica `data` se todos os campos do WHERE (além do id) baterem agora.
  function bate(alvo: Record<string, unknown>, where: Record<string, unknown>) {
    return Object.entries(where).every(
      ([campo, valor]) => alvo[campo] === valor,
    );
  }

  beforeEach(async () => {
    devolucao = {
      id: 5,
      pedidoId: 10,
      usuarioId: CLIENTE.id,
      status: StatusDevolucao.APROVADA,
      motivo: 'Chegou quebrada',
      descricao: null,
      solicitadaEm: new Date('2026-09-25T12:00:00Z'),
      analisadaEm: new Date('2026-09-26T12:00:00Z'),
      observacaoAnalise: null,
      analisadoPorId: 99,
      recebidaEm: null,
    };
    usuario = {
      nome: 'Cliente Sensora',
      email: 'cliente@sensora.dev',
      cpf: '52998224725',
      telefone: '41999998888',
    };
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
      enderecoCep: '01310-100',
      enderecoRua: 'Av. Paulista',
      enderecoNumero: '1000',
      enderecoComplemento: 'Ap 12',
      enderecoBairro: 'Bela Vista',
      enderecoCidade: 'São Paulo',
      enderecoEstado: 'SP',
    };
    envios = [];
    noMelhorEnvio = situacao();

    const prisma = {
      // Só para a listagem do cliente (listarDoPedido).
      pedido: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            ...pedido,
            usuarioId: CLIENTE.id,
            itens: [{ id: 100, quantidade: 3 }],
          }),
        ),
      },
      itemDevolucao: { findMany: jest.fn(() => Promise.resolve([])) },
      devolucao: {
        findMany: jest.fn(() => Promise.resolve([comRelacoes()])),
        findUnique: jest.fn(async ({ where }: { where: { id: number } }) => {
          await tick();
          return where.id === devolucao.id ? comRelacoes() : null;
        }),
        updateMany: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: number; status: StatusDevolucao };
            data: Partial<DevolucaoFake>;
          }) => {
            await tick();
            if (
              where.id !== devolucao.id ||
              devolucao.status !== where.status
            ) {
              return { count: 0 };
            }
            Object.assign(devolucao, data);
            return { count: 1 };
          },
        ),
      },
      envioDevolucao: {
        create: jest.fn(async ({ data }: { data: Partial<EnvioFake> }) => {
          await tick();
          if (envios.some((e) => e.devolucaoId === data.devolucaoId)) {
            throw new Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed on the fields: (`devolucaoId`)',
              { code: 'P2002', clientVersion: 'test' },
            );
          }
          const envio: EnvioFake = {
            id: envios.length + 1,
            devolucaoId: data.devolucaoId!,
            provedor: 'MELHOR_ENVIO',
            idExterno: null,
            servicoId: data.servicoId!,
            transportadora: data.transportadora!,
            servico: data.servico!,
            custo: data.custo!,
            compradaEm: null,
            geradaEm: null,
            codigoDevolucao: null,
            codigoRastreio: null,
            postadaEm: null,
            situacaoRastreio: null,
            rastreioAtualizadoEm: null,
            criadoEm: new Date(),
            atualizadoEm: new Date(),
          };
          envios.push(envio);
          return { ...envio };
        }),
        findUnique: jest.fn(
          async ({
            where,
          }: {
            where: { id?: number; devolucaoId?: number };
          }) => {
            await tick();
            const envio = envios.find((e) =>
              where.id !== undefined
                ? e.id === where.id
                : e.devolucaoId === where.devolucaoId,
            );
            return envio ? { ...envio } : null;
          },
        ),
        updateMany: jest.fn(
          async ({
            where: { id, ...condicao },
            data,
          }: {
            where: { id: number } & Record<string, unknown>;
            data: Partial<EnvioFake>;
          }) => {
            await tick();
            const envio = envios.find((e) => e.id === id);
            if (!envio || !bate(envio, condicao)) {
              return { count: 0 };
            }
            Object.assign(envio, data);
            return { count: 1 };
          },
        ),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: number };
            data: Partial<EnvioFake>;
          }) => {
            await tick();
            const envio = envios.find((e) => e.id === where.id)!;
            Object.assign(envio, data);
            return { ...envio };
          },
        ),
      },
    };

    let proximoId = 0;
    me = {
      dadosLojaFaltando: [],
      pacoteParaQuantidade: jest.fn((quantidade: number) => ({
        alturaCm: 10,
        larguraCm: 15,
        comprimentoCm: 20,
        pesoGramas: 300 * quantidade,
      })),
      cotarReversa: jest.fn(async () => {
        await tick();
        return OPCOES;
      }),
      criarReversa: jest.fn(async () => {
        await tick();
        proximoId += 1;
        return { id: `ord-${proximoId}`, preco: 24.9 };
      }),
      comprarEnvio: jest.fn(async () => {
        await tick();
        noMelhorEnvio = {
          ...noMelhorEnvio,
          status: 'released',
          pago: true,
          pagoEm: new Date('2026-09-30T13:00:00Z'),
        };
      }),
      // A geração libera o código de devolução (authorization_code); o
      // rastreio do objeto pode ou não vir junto.
      gerarEnvio: jest.fn(async () => {
        await tick();
        noMelhorEnvio = {
          ...noMelhorEnvio,
          status: 'generated',
          gerado: true,
          geradoEm: new Date('2026-09-30T13:01:00Z'),
          codigoDevolucao: '1234567890',
          codigoRastreio: 'ME2600000001BR',
        };
      }),
      urlImpressao: jest.fn(async () => {
        await tick();
        return 'https://melhorenvio.com.br/imprimir/abc123';
      }),
      consultarEnvio: jest.fn(async () => {
        await tick();
        return { ...noMelhorEnvio };
      }),
    };

    mail = { enviarEmail: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevolucoesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ImagekitService,
          useValue: { gerarUrlAssinada: jest.fn(() => 'https://ik/x') },
        },
        { provide: MailService, useValue: mail },
        { provide: MelhorEnvioService, useValue: me },
        { provide: AsaasService, useValue: {} },
      ],
    }).compile();

    service = module.get(DevolucoesService);
  });

  // Nenhuma chamada ao Melhor Envio que custe dinheiro ou crie envio.
  function nadaFoiFeitoNoMelhorEnvio() {
    expect(me.cotarReversa).not.toHaveBeenCalled();
    expect(me.criarReversa).not.toHaveBeenCalled();
    expect(me.comprarEnvio).not.toHaveBeenCalled();
    expect(me.gerarEnvio).not.toHaveBeenCalled();
    expect(envios).toHaveLength(0);
  }

  describe('cotarFreteDevolucao', () => {
    it('cota do CEP do cliente (endereço do pedido) para a loja, com o pacote e o valor dos itens devolvidos', async () => {
      const opcoes = await service.cotarFreteDevolucao(5);

      expect(opcoes).toEqual(OPCOES);
      expect(me.pacoteParaQuantidade).toHaveBeenCalledWith(2);
      expect(me.cotarReversa).toHaveBeenCalledWith(
        '01310-100',
        expect.objectContaining({ pesoGramas: 600 }),
        119.8,
      );
    });

    it('devolução inexistente: 404', async () => {
      await expect(service.cotarFreteDevolucao(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(me.cotarReversa).not.toHaveBeenCalled();
    });

    it.each([
      StatusDevolucao.SOLICITADA,
      StatusDevolucao.EM_ANALISE,
      StatusDevolucao.RECUSADA,
      StatusDevolucao.AGUARDANDO_ENVIO,
    ])('status %s: 409', async (status) => {
      devolucao.status = status;
      await expect(service.cotarFreteDevolucao(5)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(me.cotarReversa).not.toHaveBeenCalled();
    });
  });

  describe('gerarLogistica', () => {
    it('caminho feliz: cria, compra e gera; grava cada passo e o código de devolução; vai para AGUARDANDO_ENVIO e avisa o cliente sem código nem URL', async () => {
      const resultado = await service.gerarLogistica(5, 1, 25.35);

      expect(me.criarReversa).toHaveBeenCalledTimes(1);
      const [[entrada]] = me.criarReversa.mock.calls as unknown[][];
      expect(entrada).toEqual({
        servicoId: 1,
        remetente: {
          nome: 'Cliente Sensora',
          cpf: '52998224725',
          telefone: '41999998888',
          email: 'cliente@sensora.dev',
          rua: 'Av. Paulista',
          numero: '1000',
          complemento: 'Ap 12',
          bairro: 'Bela Vista',
          cidade: 'São Paulo',
          uf: 'SP',
          cep: '01310-100',
        },
        itens: [{ nome: 'Vela Lavanda', quantidade: 2, valorUnitario: 59.9 }],
        pacote: expect.objectContaining({ pesoGramas: 600 }) as unknown,
        valorDeclarado: 119.8,
      });
      expect(me.comprarEnvio).toHaveBeenCalledWith('ord-1');
      expect(me.gerarEnvio).toHaveBeenCalledWith('ord-1');

      expect(envios).toHaveLength(1);
      expect(envios[0]).toMatchObject({
        idExterno: 'ord-1',
        servicoId: 1,
        transportadora: 'Correios',
        servico: 'PAC',
        custo: 24.9, // preço devolvido pelo Melhor Envio na criação
        compradaEm: expect.any(Date) as unknown,
        geradaEm: new Date('2026-09-30T13:01:00Z'),
        codigoDevolucao: '1234567890',
        codigoRastreio: 'ME2600000001BR',
      });
      expect(devolucao.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);

      expect(resultado.envio).toMatchObject({
        transportadora: 'Correios',
        servico: 'PAC',
        custo: 24.9,
        codigoDevolucao: '1234567890',
        codigoRastreio: 'ME2600000001BR',
      });
      expect(JSON.stringify(resultado)).not.toContain('ord-1');

      expect(mail.enviarEmail).toHaveBeenCalledTimes(1);
      const [[email]] = mail.enviarEmail.mock.calls as [
        { to: string; subject: string; html: string },
      ][];
      expect(email.to).toBe('cliente@sensora.dev');
      expect(email.subject).toContain('Código de devolução disponível');
      expect(email.html).toContain('código de devolução');
      expect(email.html).toContain('Não é preciso imprimir etiqueta');
      // O código fica só na conta do cliente: nem ele nem URL vão no e-mail.
      expect(email.html).not.toContain('1234567890');
      expect(email.html).not.toMatch(/https?:\/\//);
      expect(me.urlImpressao).not.toHaveBeenCalled();
    });

    it('serviço escolhido é conferido numa cotação nova: fora das opções, 400 e nada é criado', async () => {
      await expect(service.gerarLogistica(5, 17, 10)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(envios).toHaveLength(0);
      expect(me.criarReversa).not.toHaveBeenCalled();
    });

    it('devolução inexistente: 404', async () => {
      await expect(
        service.gerarLogistica(999, 1, 25.35),
      ).rejects.toBeInstanceOf(NotFoundException);
      nadaFoiFeitoNoMelhorEnvio();
    });

    it.each([
      StatusDevolucao.SOLICITADA,
      StatusDevolucao.EM_ANALISE,
      StatusDevolucao.RECUSADA,
      StatusDevolucao.CANCELADA,
      StatusDevolucao.ENVIADA,
    ])('status %s: 409, nada é feito no Melhor Envio', async (status) => {
      devolucao.status = status;
      await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toBeInstanceOf(
        ConflictException,
      );
      nadaFoiFeitoNoMelhorEnvio();
    });

    it('CPF ausente: 409 com instrução, nada é feito no Melhor Envio', async () => {
      usuario!.cpf = null;
      await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(/CPF/);
      nadaFoiFeitoNoMelhorEnvio();
    });

    it('telefone ausente: 409 com instrução, nada é feito no Melhor Envio', async () => {
      usuario!.telefone = null;
      await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
        /telefone/,
      );
      nadaFoiFeitoNoMelhorEnvio();
    });

    it('conta do cliente excluída: 409, nunca usa dados inventados', async () => {
      usuario = null;
      await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toBeInstanceOf(
        ConflictException,
      );
      nadaFoiFeitoNoMelhorEnvio();
    });

    it('endereço do pedido incompleto: 409', async () => {
      pedido.enderecoNumero = null;
      await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
        /endereço/,
      );
      nadaFoiFeitoNoMelhorEnvio();
    });

    it('dados da loja ausentes: erro com os nomes das variáveis, nada é feito no Melhor Envio', async () => {
      me.dadosLojaFaltando = ['LOJA_DOCUMENTO', 'LOJA_TELEFONE'];
      const erro = await service
        .gerarLogistica(5, 1, 25.35)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ConflictException);
      expect((erro as Error).message).toContain(
        'LOJA_DOCUMENTO, LOJA_TELEFONE',
      );
      nadaFoiFeitoNoMelhorEnvio();
    });

    it('geração duplicada: com a logística já gerada, 409 e nenhuma chamada ao Melhor Envio', async () => {
      await service.gerarLogistica(5, 1, 25.35);
      jest.clearAllMocks();

      await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
        'A logística reversa desta devolução já foi gerada.',
      );
      expect(me.criarReversa).not.toHaveBeenCalled();
      expect(me.comprarEnvio).not.toHaveBeenCalled();
      expect(me.gerarEnvio).not.toHaveBeenCalled();
      expect(envios).toHaveLength(1);
      expect(mail.enviarEmail).not.toHaveBeenCalled();
    });

    it('envio em andamento com outro serviço: 409, não troca o serviço no meio', async () => {
      me.comprarEnvio.mockRejectedValueOnce(
        new MelhorEnvioIndisponivelError('fora do ar'),
      );
      await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
        'fora do ar',
      );

      await expect(service.gerarLogistica(5, 2, 41.2)).rejects.toThrow(
        /continue com esse serviço/,
      );
      expect(me.criarReversa).toHaveBeenCalledTimes(1);
    });

    it('dois ADMINs ao mesmo tempo: um único envio, uma única reversa paga, um único e-mail', async () => {
      const [a, b] = await Promise.allSettled([
        service.gerarLogistica(5, 1, 25.35),
        service.gerarLogistica(5, 1, 25.35),
      ]);

      expect(a.status).toBe('fulfilled');
      expect(b.status).toBe('fulfilled');
      expect(envios).toHaveLength(1);
      expect(me.cotarReversa).toHaveBeenCalledTimes(2);

      // As duas tentativas podem ter criado uma reversa no carrinho (sem
      // custo), mas só a gravada em idExterno é comprada e gerada.
      const idGravado = envios[0].idExterno;
      for (const [id] of me.comprarEnvio.mock.calls) {
        expect(id).toBe(idGravado);
      }
      for (const [id] of me.gerarEnvio.mock.calls) {
        expect(id).toBe(idGravado);
      }
      expect(devolucao.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
      expect(mail.enviarEmail).toHaveBeenCalledTimes(1);
    });

    describe('retomada depois de erro', () => {
      it('erro ao criar a reversa: envio fica sem idExterno; a nova tentativa cria a reversa sem cotar de novo', async () => {
        me.criarReversa.mockRejectedValueOnce(
          new MelhorEnvioErroHttpError('recusou'),
        );
        await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
          'recusou',
        );
        expect(envios[0]).toMatchObject({ idExterno: null, compradaEm: null });
        expect(devolucao.status).toBe(StatusDevolucao.APROVADA);

        await service.gerarLogistica(5, 1, 25.35);

        expect(me.cotarReversa).toHaveBeenCalledTimes(1);
        expect(me.criarReversa).toHaveBeenCalledTimes(2);
        expect(envios).toHaveLength(1);
        expect(devolucao.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
      });

      it('erro depois de criar e antes de comprar: a nova tentativa continua do mesmo idExterno, sem criar outra reversa', async () => {
        me.consultarEnvio.mockRejectedValueOnce(
          new MelhorEnvioIndisponivelError('fora do ar'),
        );
        await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
          'fora do ar',
        );
        expect(envios[0]).toMatchObject({
          idExterno: 'ord-1',
          compradaEm: null,
        });

        await service.gerarLogistica(5, 1, 25.35);

        expect(me.criarReversa).toHaveBeenCalledTimes(1);
        expect(me.comprarEnvio).toHaveBeenCalledTimes(1);
        expect(me.comprarEnvio).toHaveBeenCalledWith('ord-1');
        expect(devolucao.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
      });

      it('erro na compra: a nova tentativa consulta o envio e compra o mesmo idExterno', async () => {
        me.comprarEnvio.mockRejectedValueOnce(
          new MelhorEnvioIndisponivelError('fora do ar'),
        );
        await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
          'fora do ar',
        );

        await service.gerarLogistica(5, 1, 25.35);

        expect(me.criarReversa).toHaveBeenCalledTimes(1);
        expect(me.comprarEnvio).toHaveBeenCalledTimes(2);
        expect(me.comprarEnvio).toHaveBeenLastCalledWith('ord-1');
      });

      it('compra feita no Melhor Envio mas não gravada aqui: a nova tentativa vê que já está pago e NÃO compra de novo', async () => {
        // A compra passa no Melhor Envio, mas a resposta se perde.
        me.comprarEnvio.mockImplementationOnce(() => {
          noMelhorEnvio = {
            ...noMelhorEnvio,
            status: 'released',
            pago: true,
            pagoEm: new Date('2026-09-30T13:00:00Z'),
          };
          return Promise.reject(
            new MelhorEnvioIndisponivelError('resposta perdida'),
          );
        });
        await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
          'resposta perdida',
        );
        expect(envios[0].compradaEm).toBeNull();

        await service.gerarLogistica(5, 1, 25.35);

        expect(me.comprarEnvio).toHaveBeenCalledTimes(1);
        expect(envios[0].compradaEm).toEqual(new Date('2026-09-30T13:00:00Z'));
        expect(devolucao.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
      });

      it('erro na geração: a nova tentativa não compra de novo e só gera', async () => {
        me.gerarEnvio.mockRejectedValueOnce(
          new MelhorEnvioErroHttpError(
            'O Melhor Envio não gerou o código de devolução.',
          ),
        );
        await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
          'não gerou o código de devolução',
        );
        expect(envios[0].compradaEm).not.toBeNull();
        expect(envios[0].geradaEm).toBeNull();
        expect(devolucao.status).toBe(StatusDevolucao.APROVADA);
        expect(mail.enviarEmail).not.toHaveBeenCalled();

        await service.gerarLogistica(5, 1, 25.35);

        expect(me.comprarEnvio).toHaveBeenCalledTimes(1);
        expect(me.gerarEnvio).toHaveBeenCalledTimes(2);
        expect(envios[0].codigoRastreio).toBe('ME2600000001BR');
        expect(devolucao.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
      });

      it('envio já gerado no Melhor Envio mas não gravado aqui: não gera de novo e grava o código', async () => {
        me.gerarEnvio.mockImplementationOnce(() => {
          noMelhorEnvio = {
            ...noMelhorEnvio,
            status: 'generated',
            gerado: true,
            geradoEm: new Date('2026-09-30T13:01:00Z'),
            codigoDevolucao: '1234567890',
            codigoRastreio: 'ME2600000001BR',
          };
          return Promise.reject(
            new MelhorEnvioIndisponivelError('resposta perdida'),
          );
        });
        await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
          'resposta perdida',
        );

        await service.gerarLogistica(5, 1, 25.35);

        expect(me.gerarEnvio).toHaveBeenCalledTimes(1);
        expect(envios[0].geradaEm).toEqual(new Date('2026-09-30T13:01:00Z'));
        expect(envios[0].codigoDevolucao).toBe('1234567890');
        expect(envios[0].codigoRastreio).toBe('ME2600000001BR');
      });
    });

    it('saldo insuficiente: erro claro, devolução continua APROVADA, idExterno preservado para tentar de novo', async () => {
      me.comprarEnvio.mockRejectedValueOnce(
        new MelhorEnvioErroHttpError(
          'Saldo insuficiente na carteira do Melhor Envio para comprar o envio da devolução.',
        ),
      );

      await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
        /Saldo insuficiente/,
      );
      expect(devolucao.status).toBe(StatusDevolucao.APROVADA);
      expect(envios[0]).toMatchObject({ idExterno: 'ord-1', compradaEm: null });
      expect(me.gerarEnvio).not.toHaveBeenCalled();
      expect(mail.enviarEmail).not.toHaveBeenCalled();
    });

    it('erro do Melhor Envio fora do ar na cotação: propaga, nada é criado', async () => {
      me.cotarReversa.mockRejectedValueOnce(
        new MelhorEnvioIndisponivelError('fora do ar'),
      );
      await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toBeInstanceOf(
        MelhorEnvioIndisponivelError,
      );
      expect(envios).toHaveLength(0);
      expect(devolucao.status).toBe(StatusDevolucao.APROVADA);
    });

    it('custo do envio criado maior que o confirmado: 409, nada é cobrado; confirmando o novo valor, continua', async () => {
      me.criarReversa.mockResolvedValueOnce({ id: 'ord-1', preco: 31.5 });

      await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
        'O custo do envio informado pelo Melhor Envio é R$ 31,50, maior que o confirmado (R$ 25,35). Nada foi cobrado; confirme o novo valor para continuar.',
      );
      expect(me.comprarEnvio).not.toHaveBeenCalled();
      expect(envios[0]).toMatchObject({
        idExterno: 'ord-1',
        custo: 31.5,
        compradaEm: null,
      });
      expect(devolucao.status).toBe(StatusDevolucao.APROVADA);

      await service.gerarLogistica(5, 1, 31.5);

      expect(me.criarReversa).toHaveBeenCalledTimes(1);
      expect(me.comprarEnvio).toHaveBeenCalledTimes(1);
      expect(devolucao.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
    });

    it('custo menor ou igual ao confirmado: compra normalmente', async () => {
      me.criarReversa.mockResolvedValueOnce({ id: 'ord-1', preco: 25.35 });
      await service.gerarLogistica(5, 1, 25.35);
      expect(me.comprarEnvio).toHaveBeenCalledTimes(1);
    });

    it('envio já pago no Melhor Envio: não confere o custo de novo nem compra', async () => {
      me.criarReversa.mockResolvedValueOnce({ id: 'ord-1', preco: 31.5 });
      me.comprarEnvio.mockImplementationOnce(() => {
        noMelhorEnvio = { ...noMelhorEnvio, pago: true, status: 'released' };
        return Promise.reject(new MelhorEnvioIndisponivelError('perdida'));
      });
      // Confirmou 31,50, a compra passou no Melhor Envio mas a resposta se perdeu.
      await expect(service.gerarLogistica(5, 1, 31.5)).rejects.toThrow(
        'perdida',
      );

      // Nova tentativa com o valor antigo da tela: já está pago, só segue.
      await service.gerarLogistica(5, 1, 25.35);
      expect(me.comprarEnvio).toHaveBeenCalledTimes(1);
      expect(devolucao.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
    });

    it('código de devolução ainda não liberado na geração: segue para AGUARDANDO_ENVIO sem inventar código', async () => {
      me.gerarEnvio.mockImplementationOnce(() => {
        noMelhorEnvio = {
          ...noMelhorEnvio,
          status: 'generated',
          gerado: true,
          geradoEm: new Date('2026-09-30T13:01:00Z'),
        };
        return Promise.resolve();
      });

      const resultado = await service.gerarLogistica(5, 1, 25.35);

      expect(resultado.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
      expect(envios[0].codigoDevolucao).toBeNull();
      expect(envios[0].codigoRastreio).toBeNull();
    });

    describe('confirmação do pagamento', () => {
      // Checkout responde sucesso, mas o Melhor Envio não marca o envio como pago.
      function checkoutSemPagamento() {
        me.comprarEnvio.mockImplementationOnce(() => Promise.resolve());
      }

      it('pagamento confirmado: consulta depois da compra e grava compradaEm com a data do Melhor Envio', async () => {
        await service.gerarLogistica(5, 1, 25.35);
        // Uma consulta antes da compra e outra logo depois dela.
        const [compra] = me.comprarEnvio.mock.invocationCallOrder;
        expect(
          me.consultarEnvio.mock.invocationCallOrder.some((n) => n > compra),
        ).toBe(true);
        expect(envios[0].compradaEm).toEqual(new Date('2026-09-30T13:00:00Z'));
        expect(devolucao.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
      });

      it('checkout com sucesso mas sem pagamento: 409, compradaEm continua nulo, nada é gerado', async () => {
        checkoutSemPagamento();

        await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
          'O Melhor Envio ainda não confirmou o pagamento do envio.',
        );

        expect(envios[0]).toMatchObject({
          idExterno: 'ord-1',
          compradaEm: null,
        });
        expect(me.gerarEnvio).not.toHaveBeenCalled();
        expect(devolucao.status).toBe(StatusDevolucao.APROVADA);
        expect(mail.enviarEmail).not.toHaveBeenCalled();
      });

      it('nova tentativa depois do sucesso sem pagamento: se o pagamento já constar, não compra de novo e segue', async () => {
        checkoutSemPagamento();
        await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
          ConflictException,
        );

        // O pagamento é confirmado depois pelo Melhor Envio.
        noMelhorEnvio = {
          ...noMelhorEnvio,
          status: 'released',
          pago: true,
          pagoEm: new Date('2026-09-30T13:05:00Z'),
        };
        await service.gerarLogistica(5, 1, 25.35);

        expect(me.comprarEnvio).toHaveBeenCalledTimes(1);
        expect(me.criarReversa).toHaveBeenCalledTimes(1);
        expect(envios[0].compradaEm).toEqual(new Date('2026-09-30T13:05:00Z'));
        expect(devolucao.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
      });

      it('nova tentativa com o pagamento ainda não confirmado: compra o MESMO envio de novo (o Melhor Envio não cobra duas vezes) e segue', async () => {
        checkoutSemPagamento();
        await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow(
          ConflictException,
        );

        await service.gerarLogistica(5, 1, 25.35);

        expect(me.criarReversa).toHaveBeenCalledTimes(1);
        expect(me.comprarEnvio).toHaveBeenCalledTimes(2);
        for (const [id] of me.comprarEnvio.mock.calls) {
          expect(id).toBe('ord-1');
        }
        expect(envios[0].compradaEm).not.toBeNull();
        expect(devolucao.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
      });
    });

    it('falha no e-mail não desfaz a logística', async () => {
      mail.enviarEmail.mockRejectedValueOnce(new Error('SMTP fora'));
      const resultado = await service.gerarLogistica(5, 1, 25.35);
      expect(resultado.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
    });
  });

  describe('documento do envio (recurso secundário)', () => {
    async function comLogisticaGerada() {
      await service.gerarLogistica(5, 1, 25.35);
      jest.clearAllMocks();
    }

    it('ADMIN: URL pedida ao Melhor Envio a cada acesso e nunca gravada', async () => {
      await comLogisticaGerada();

      await expect(service.documentoParaAdmin(5)).resolves.toEqual({
        url: 'https://melhorenvio.com.br/imprimir/abc123',
      });
      await service.documentoParaAdmin(5);

      expect(me.urlImpressao).toHaveBeenCalledTimes(2);
      expect(me.urlImpressao).toHaveBeenCalledWith('ord-1');
      expect(JSON.stringify(envios)).not.toContain('imprimir');
    });

    it('ADMIN: sem logística gerada, 409; inexistente, 404', async () => {
      await expect(service.documentoParaAdmin(5)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.documentoParaAdmin(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(me.urlImpressao).not.toHaveBeenCalled();
    });

    it('CLIENTE dono em AGUARDANDO_ENVIO: recebe a URL gerada agora', async () => {
      await comLogisticaGerada();
      await expect(
        service.documentoParaCliente(10, 5, CLIENTE),
      ).resolves.toEqual({ url: 'https://melhorenvio.com.br/imprimir/abc123' });
    });

    it.each([
      ['outro cliente', 10, { ...CLIENTE, id: 2 }],
      ['pedido errado na URL', 11, CLIENTE],
    ])('%s: 404, sem pedir URL', async (_caso, pedidoId, user) => {
      await comLogisticaGerada();
      await expect(
        service.documentoParaCliente(pedidoId, 5, user),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(me.urlImpressao).not.toHaveBeenCalled();
    });

    it('CLIENTE: devolução inexistente, 404', async () => {
      await expect(
        service.documentoParaCliente(10, 999, CLIENTE),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([StatusDevolucao.APROVADA, StatusDevolucao.ENVIADA])(
      'CLIENTE com a devolução em %s: 409',
      async (status) => {
        await comLogisticaGerada();
        devolucao.status = status;
        await expect(
          service.documentoParaCliente(10, 5, CLIENTE),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(me.urlImpressao).not.toHaveBeenCalled();
      },
    );

    it('resposta da devolução ao cliente traz código de devolução e rastreio, sem idExterno, custo nem situação do provedor', async () => {
      await comLogisticaGerada();
      const resultado = await service.buscar(10, 5, CLIENTE);

      expect(resultado.envio).toEqual({
        transportadora: 'Correios',
        servico: 'PAC',
        codigoDevolucao: '1234567890',
        codigoRastreio: 'ME2600000001BR',
        postadaEm: null,
      });
      expect(JSON.stringify(resultado)).not.toMatch(
        /ord-1|custo|24\.9|situacao|generated|idExterno/,
      );

      // Mesma regra na listagem do pedido.
      const lista = await service.listarDoPedido(10, CLIENTE);
      expect(JSON.stringify(lista)).not.toMatch(/ord-1|custo|idExterno/);
    });

    it('antes de a logística estar gerada, o cliente não vê envio nenhum', async () => {
      me.gerarEnvio.mockRejectedValueOnce(new MelhorEnvioErroHttpError('x'));
      await expect(service.gerarLogistica(5, 1, 25.35)).rejects.toThrow('x');

      const resultado = await service.buscar(10, 5, CLIENTE);
      expect(resultado.envio).toBeNull();
    });
  });

  describe('atualizarRastreio', () => {
    beforeEach(async () => {
      await service.gerarLogistica(5, 1, 25.35);
      jest.clearAllMocks();
    });

    it('ainda não postado: consulta o envio, guarda a última situação, continua AGUARDANDO_ENVIO', async () => {
      const resultado = await service.atualizarRastreio(5);

      expect(me.consultarEnvio).toHaveBeenCalledWith('ord-1');
      expect(envios[0].situacaoRastreio).toBe('generated');
      expect(envios[0].rastreioAtualizadoEm).toBeInstanceOf(Date);
      expect(resultado.status).toBe(StatusDevolucao.AGUARDANDO_ENVIO);
    });

    it('postado: grava postadaEm e move AGUARDANDO_ENVIO -> ENVIADA', async () => {
      noMelhorEnvio = {
        ...noMelhorEnvio,
        status: 'posted',
        postado: true,
        postadoEm: new Date('2026-10-01T09:00:00Z'),
      };

      const resultado = await service.atualizarRastreio(5);

      expect(envios[0]).toMatchObject({
        situacaoRastreio: 'posted',
        postadaEm: new Date('2026-10-01T09:00:00Z'),
      });
      expect(resultado.status).toBe(StatusDevolucao.ENVIADA);
    });

    it('já RECEBIDA: atualiza a situação mas nunca volta o status', async () => {
      devolucao.status = StatusDevolucao.RECEBIDA;
      noMelhorEnvio = { ...noMelhorEnvio, status: 'delivered', postado: true };

      await service.atualizarRastreio(5);

      expect(devolucao.status).toBe(StatusDevolucao.RECEBIDA);
      expect(envios[0].situacaoRastreio).toBe('delivered');
    });

    it('código de devolução liberado depois da geração: a consulta o grava; nunca apaga um código já gravado', async () => {
      envios[0].codigoDevolucao = null;
      await service.atualizarRastreio(5);
      expect(envios[0].codigoDevolucao).toBe('1234567890');

      noMelhorEnvio = { ...noMelhorEnvio, codigoDevolucao: null };
      await service.atualizarRastreio(5);
      expect(envios[0].codigoDevolucao).toBe('1234567890');
    });

    it('sem logística gerada: 409; inexistente: 404', async () => {
      envios[0].geradaEm = null;
      await expect(service.atualizarRastreio(5)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(service.atualizarRastreio(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(me.consultarEnvio).not.toHaveBeenCalled();
    });
  });

  describe('confirmarRecebimento', () => {
    it('ENVIADA -> RECEBIDA, grava recebidaEm', async () => {
      devolucao.status = StatusDevolucao.ENVIADA;

      const resultado = await service.confirmarRecebimento(5);

      expect(devolucao.status).toBe(StatusDevolucao.RECEBIDA);
      expect(devolucao.recebidaEm).toBeInstanceOf(Date);
      expect(resultado.recebidaEm).toEqual(devolucao.recebidaEm);
    });

    it.each([
      StatusDevolucao.APROVADA,
      StatusDevolucao.AGUARDANDO_ENVIO,
      StatusDevolucao.RECEBIDA,
    ])('a partir de %s: 409, nada muda', async (status) => {
      devolucao.status = status;
      await expect(service.confirmarRecebimento(5)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(devolucao.status).toBe(status);
      expect(devolucao.recebidaEm).toBeNull();
    });

    it('inexistente: 404', async () => {
      await expect(service.confirmarRecebimento(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('dois ADMINs confirmando ao mesmo tempo: só um muda, o outro recebe 409', async () => {
      devolucao.status = StatusDevolucao.ENVIADA;

      const resultados = await Promise.allSettled([
        service.confirmarRecebimento(5),
        service.confirmarRecebimento(5),
      ]);

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
      const recusa = resultados.find((r) => r.status === 'rejected');
      expect(recusa?.reason).toBeInstanceOf(ConflictException);
    });
  });
});
