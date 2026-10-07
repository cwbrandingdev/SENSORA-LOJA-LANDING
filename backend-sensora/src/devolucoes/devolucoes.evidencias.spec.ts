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
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import {
  DevolucoesService,
  TAMANHO_MAXIMO_EVIDENCIA,
  type ArquivoEnviado,
} from './devolucoes.service';
import { StatusDevolucao } from './enums/status-devolucao.enum';

// Evidências (fotos) da devolução — Prisma e ImageKit MOCKADOS, "banco" em
// memória (mesmo padrão de devolucoes.service.spec.ts). O `$queryRaw`
// (SELECT ... FOR UPDATE na devolução) é simulado como uma trava: a segunda
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

const PEDIDO_ID = 10;
const DEVOLUCAO_ID = 5;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
]);

function arquivo(conteudo: Buffer, size = conteudo.length): ArquivoEnviado {
  return { buffer: conteudo, size };
}

type EvidenciaFake = {
  id: number;
  devolucaoId: number;
  fileId: string;
  caminho: string;
  criadoEm: Date;
};

describe('DevolucoesService — evidências (Etapa 5)', () => {
  let service: DevolucoesService;
  let devolucaoFake: {
    id: number;
    pedidoId: number;
    usuarioId: number | null;
    status: StatusDevolucao;
  };
  let evidenciasFake: EvidenciaFake[];
  let cadeado: Promise<void>;
  let falharGravacao: boolean;
  let enviosFeitos: number;
  let imagekit: {
    enviarArquivoPrivado: jest.Mock;
    gerarUrlAssinada: jest.Mock;
    apagarArquivo: jest.Mock;
  };

  // Mesma consulta nas duas rotas do código (com e sem transação).
  function buscarDevolucao({
    where,
    include,
  }: {
    where: { id: number };
    include: {
      _count?: unknown;
      itens?: boolean;
      evidencias?: { where?: { id: number } };
    };
  }) {
    if (where.id !== devolucaoFake.id) {
      return null;
    }
    const daDevolucao = evidenciasFake.filter(
      (e) => e.devolucaoId === devolucaoFake.id,
    );
    return {
      ...devolucaoFake,
      motivo: 'Chegou quebrada',
      descricao: null,
      solicitadaEm: new Date('2026-09-29T12:00:00Z'),
      itens: [],
      evidencias: include.evidencias?.where
        ? daDevolucao.filter((e) => e.id === include.evidencias!.where!.id)
        : daDevolucao,
      _count: { evidencias: daDevolucao.length },
    };
  }

  beforeEach(async () => {
    devolucaoFake = {
      id: DEVOLUCAO_ID,
      pedidoId: PEDIDO_ID,
      usuarioId: CLIENTE.id,
      status: StatusDevolucao.SOLICITADA,
    };
    evidenciasFake = [];
    cadeado = Promise.resolve();
    falharGravacao = false;
    enviosFeitos = 0;

    imagekit = {
      enviarArquivoPrivado: jest.fn(async () => {
        enviosFeitos += 1;
        const numero = enviosFeitos;
        // Deixa outra requisição "andar" durante o upload (como a rede real).
        await new Promise((resolve) => setImmediate(resolve));
        return {
          fileId: `file_${numero}`,
          caminho: `/sensora/devolucoes/${DEVOLUCAO_ID}/evidencia_${numero}.jpg`,
        };
      }),
      gerarUrlAssinada: jest.fn(
        (caminho: string) =>
          `https://ik.imagekit.io/sensora${caminho}?ik-t=1&ik-s=assinatura`,
      ),
      apagarArquivo: jest.fn(async () => {}),
    };

    const prisma = {
      devolucao: { findUnique: jest.fn(buscarDevolucao) },
      evidenciaDevolucao: {
        deleteMany: jest.fn(({ where }: { where: { id: number } }) => {
          evidenciasFake = evidenciasFake.filter((e) => e.id !== where.id);
          return { count: 1 };
        }),
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          let liberarTrava = () => {};
          const tx = {
            $queryRaw: async () => {
              const anterior = cadeado;
              cadeado = new Promise<void>((liberar) => {
                liberarTrava = liberar;
              });
              await anterior;
            },
            devolucao: {
              // Leitura com o retrato do momento da consulta e resposta
              // "demorada", como uma ida ao banco: sem a trava, duas
              // transações leem a mesma contagem e as duas gravam.
              findUnique: async (
                args: Parameters<typeof buscarDevolucao>[0],
              ) => {
                const resultado = buscarDevolucao(args);
                await new Promise((resolve) => setImmediate(resolve));
                return resultado;
              },
            },
            evidenciaDevolucao: {
              create: ({
                data,
              }: {
                data: { devolucaoId: number; fileId: string; caminho: string };
              }) => {
                if (falharGravacao) {
                  throw new Error('Falha simulada ao gravar');
                }
                const nova = {
                  id: evidenciasFake.length + 1,
                  criadoEm: new Date('2026-09-30T10:00:00Z'),
                  ...data,
                };
                evidenciasFake.push(nova);
                return nova;
              },
            },
          };
          try {
            return await callback(tx);
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
        { provide: ImagekitService, useValue: imagekit },
        { provide: MailService, useValue: {} },
        { provide: MelhorEnvioService, useValue: {} },
        { provide: AsaasService, useValue: {} },
        { provide: OcorrenciasService, useValue: { registrar: jest.fn() } },
      ],
    }).compile();

    service = module.get(DevolucoesService);
  });

  function evidenciaExistente(id: number): EvidenciaFake {
    const evidencia = {
      id,
      devolucaoId: DEVOLUCAO_ID,
      fileId: `file_existente_${id}`,
      caminho: `/sensora/devolucoes/${DEVOLUCAO_ID}/existente_${id}.jpg`,
      criadoEm: new Date('2026-09-30T09:00:00Z'),
    };
    evidenciasFake.push(evidencia);
    return evidencia;
  }

  describe('adicionarEvidencia', () => {
    it('upload autorizado: envia privado na pasta da devolução e devolve só id, URL assinada e data', async () => {
      const resultado = await service.adicionarEvidencia(
        PEDIDO_ID,
        DEVOLUCAO_ID,
        arquivo(JPEG),
        CLIENTE,
      );

      expect(imagekit.enviarArquivoPrivado).toHaveBeenCalledWith(
        JPEG,
        'evidencia.jpg',
        `/sensora/devolucoes/${DEVOLUCAO_ID}`,
      );
      expect(resultado).toEqual({
        id: 1,
        url: `https://ik.imagekit.io/sensora/sensora/devolucoes/${DEVOLUCAO_ID}/evidencia_1.jpg?ik-t=1&ik-s=assinatura`,
        criadoEm: new Date('2026-09-30T10:00:00Z'),
      });
      expect(resultado).not.toHaveProperty('fileId');
      expect(resultado).not.toHaveProperty('caminho');
      expect(evidenciasFake).toHaveLength(1);
      expect(evidenciasFake[0].fileId).toBe('file_1');
    });

    it.each([
      ['PNG', PNG, 'evidencia.png'],
      ['WEBP', WEBP, 'evidencia.webp'],
    ])(
      'aceita %s (identificado pelos bytes)',
      async (_formato, conteudo, nome) => {
        await service.adicionarEvidencia(
          PEDIDO_ID,
          DEVOLUCAO_ID,
          arquivo(conteudo),
          CLIENTE,
        );

        expect(imagekit.enviarArquivoPrivado).toHaveBeenCalledWith(
          conteudo,
          nome,
          `/sensora/devolucoes/${DEVOLUCAO_ID}`,
        );
      },
    );

    it.each([
      ['PDF', Buffer.from('%PDF-1.4 conteúdo')],
      ['texto renomeado para .jpg', Buffer.from('não sou uma imagem')],
      ['GIF', Buffer.from('GIF89a')],
      [
        'RIFF que não é WEBP (WAV)',
        Buffer.concat([
          Buffer.from('RIFF'),
          Buffer.alloc(4),
          Buffer.from('WAVE'),
        ]),
      ],
      ['arquivo vazio', Buffer.alloc(0)],
    ])('recusa formato inválido: %s', async (_caso, conteudo) => {
      await expect(
        service.adicionarEvidencia(
          PEDIDO_ID,
          DEVOLUCAO_ID,
          arquivo(conteudo),
          CLIENTE,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(imagekit.enviarArquivoPrivado).not.toHaveBeenCalled();
    });

    it('recusa arquivo acima de 5 MB', async () => {
      await expect(
        service.adicionarEvidencia(
          PEDIDO_ID,
          DEVOLUCAO_ID,
          arquivo(JPEG, TAMANHO_MAXIMO_EVIDENCIA + 1),
          CLIENTE,
        ),
      ).rejects.toThrow(
        new BadRequestException('A foto deve ter no máximo 5 MB.'),
      );
      expect(imagekit.enviarArquivoPrivado).not.toHaveBeenCalled();
    });

    it('recusa requisição sem arquivo', async () => {
      await expect(
        service.adicionarEvidencia(PEDIDO_ID, DEVOLUCAO_ID, undefined, CLIENTE),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['usuário errado', PEDIDO_ID, DEVOLUCAO_ID, OUTRO_CLIENTE],
      ['devolução inexistente', PEDIDO_ID, 999, CLIENTE],
      ['pedido errado na URL', 99, DEVOLUCAO_ID, CLIENTE],
    ])(
      '%s: 404 e nada é enviado',
      async (_caso, pedidoId, devolucaoId, user) => {
        await expect(
          service.adicionarEvidencia(
            pedidoId,
            devolucaoId,
            arquivo(JPEG),
            user,
          ),
        ).rejects.toThrow(new NotFoundException('Devolução não encontrada'));
        expect(imagekit.enviarArquivoPrivado).not.toHaveBeenCalled();
      },
    );

    it('devolução fora de SOLICITADA: 409 e nada é enviado', async () => {
      devolucaoFake.status = StatusDevolucao.EM_ANALISE;

      await expect(
        service.adicionarEvidencia(
          PEDIDO_ID,
          DEVOLUCAO_ID,
          arquivo(JPEG),
          CLIENTE,
        ),
      ).rejects.toThrow(ConflictException);
      expect(imagekit.enviarArquivoPrivado).not.toHaveBeenCalled();
    });

    it('limite de 5 fotos: a 6ª é recusada antes de enviar', async () => {
      [1, 2, 3, 4, 5].forEach(evidenciaExistente);

      await expect(
        service.adicionarEvidencia(
          PEDIDO_ID,
          DEVOLUCAO_ID,
          arquivo(JPEG),
          CLIENTE,
        ),
      ).rejects.toThrow(
        new BadRequestException('Limite de 5 fotos por devolução atingido.'),
      );
      expect(imagekit.enviarArquivoPrivado).not.toHaveBeenCalled();
    });

    it('concorrência: com 4 fotos, dois uploads simultâneos — só um grava, o outro é apagado do ImageKit', async () => {
      [1, 2, 3, 4].forEach(evidenciaExistente);

      const resultados = await Promise.allSettled([
        service.adicionarEvidencia(
          PEDIDO_ID,
          DEVOLUCAO_ID,
          arquivo(JPEG),
          CLIENTE,
        ),
        service.adicionarEvidencia(
          PEDIDO_ID,
          DEVOLUCAO_ID,
          arquivo(JPEG),
          CLIENTE,
        ),
      ]);

      const recusados = resultados.filter((r) => r.status === 'rejected');
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
      expect(recusados).toHaveLength(1);
      expect(recusados[0].reason).toBeInstanceOf(BadRequestException);
      expect(evidenciasFake).toHaveLength(5);
      // Os dois passaram pela checagem inicial e subiram o arquivo; o que
      // perdeu na gravação teve o arquivo apagado.
      expect(imagekit.enviarArquivoPrivado).toHaveBeenCalledTimes(2);
      expect(imagekit.apagarArquivo).toHaveBeenCalledTimes(1);
      const gravado = evidenciasFake[4].fileId;
      expect(imagekit.apagarArquivo).not.toHaveBeenCalledWith(gravado);
    });

    it('falha ao gravar no banco depois do upload: apaga o arquivo do ImageKit e devolve o erro', async () => {
      falharGravacao = true;

      await expect(
        service.adicionarEvidencia(
          PEDIDO_ID,
          DEVOLUCAO_ID,
          arquivo(JPEG),
          CLIENTE,
        ),
      ).rejects.toThrow('Falha simulada ao gravar');

      expect(imagekit.apagarArquivo).toHaveBeenCalledWith('file_1');
      expect(evidenciasFake).toHaveLength(0);
    });

    it('falha ao gravar e também ao apagar: devolve o erro original', async () => {
      falharGravacao = true;
      imagekit.apagarArquivo.mockRejectedValueOnce(new Error('ImageKit fora'));

      await expect(
        service.adicionarEvidencia(
          PEDIDO_ID,
          DEVOLUCAO_ID,
          arquivo(JPEG),
          CLIENTE,
        ),
      ).rejects.toThrow('Falha simulada ao gravar');
    });
  });

  describe('buscar', () => {
    it('dono vê a devolução com as fotos em URLs assinadas de validade curta', async () => {
      const evidencia = evidenciaExistente(1);

      const resultado = await service.buscar(PEDIDO_ID, DEVOLUCAO_ID, CLIENTE);

      expect(resultado.id).toBe(DEVOLUCAO_ID);
      expect(resultado.evidencias).toEqual([
        {
          id: 1,
          url: `https://ik.imagekit.io/sensora${evidencia.caminho}?ik-t=1&ik-s=assinatura`,
          criadoEm: evidencia.criadoEm,
        },
      ]);
      expect(imagekit.gerarUrlAssinada).toHaveBeenCalledWith(
        evidencia.caminho,
        600,
      );
    });

    it.each([
      ['outro cliente', PEDIDO_ID, OUTRO_CLIENTE],
      ['pedido errado na URL', 99, CLIENTE],
    ])('%s: 404, sem gerar URL', async (_caso, pedidoId, user) => {
      evidenciaExistente(1);

      await expect(
        service.buscar(pedidoId, DEVOLUCAO_ID, user),
      ).rejects.toThrow(NotFoundException);
      expect(imagekit.gerarUrlAssinada).not.toHaveBeenCalled();
    });
  });

  describe('removerEvidencia', () => {
    it('dono remove: apaga do ImageKit e depois do banco', async () => {
      evidenciaExistente(1);

      await service.removerEvidencia(PEDIDO_ID, DEVOLUCAO_ID, 1, CLIENTE);

      expect(imagekit.apagarArquivo).toHaveBeenCalledWith('file_existente_1');
      expect(evidenciasFake).toHaveLength(0);
    });

    it('outro cliente: 404 e nada é apagado', async () => {
      evidenciaExistente(1);

      await expect(
        service.removerEvidencia(PEDIDO_ID, DEVOLUCAO_ID, 1, OUTRO_CLIENTE),
      ).rejects.toThrow(NotFoundException);
      expect(imagekit.apagarArquivo).not.toHaveBeenCalled();
      expect(evidenciasFake).toHaveLength(1);
    });

    it('foto que não é desta devolução: 404', async () => {
      await expect(
        service.removerEvidencia(PEDIDO_ID, DEVOLUCAO_ID, 999, CLIENTE),
      ).rejects.toThrow(new NotFoundException('Foto não encontrada'));
      expect(imagekit.apagarArquivo).not.toHaveBeenCalled();
    });

    it('devolução fora de SOLICITADA: 409 e nada é apagado', async () => {
      evidenciaExistente(1);
      devolucaoFake.status = StatusDevolucao.APROVADA;

      await expect(
        service.removerEvidencia(PEDIDO_ID, DEVOLUCAO_ID, 1, CLIENTE),
      ).rejects.toThrow(ConflictException);
      expect(imagekit.apagarArquivo).not.toHaveBeenCalled();
      expect(evidenciasFake).toHaveLength(1);
    });

    it('falha ao apagar no ImageKit: o registro continua no banco', async () => {
      evidenciaExistente(1);
      imagekit.apagarArquivo.mockRejectedValueOnce(new Error('ImageKit fora'));

      await expect(
        service.removerEvidencia(PEDIDO_ID, DEVOLUCAO_ID, 1, CLIENTE),
      ).rejects.toThrow('ImageKit fora');
      expect(evidenciasFake).toHaveLength(1);
    });
  });
});
