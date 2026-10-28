import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CARRINHO_ABANDONO_MINUTOS_PADRAO,
  CarrinhoService,
} from './carrinho.service';

const primeiraChamada = (mock: jest.Mock): unknown =>
  (mock.mock.calls as unknown[][])[0][0];

const PRODUTO_LAVANDA = {
  id: 10,
  nome: 'Vela Lavanda',
  slug: 'vela-lavanda',
  preco: 59.9,
  imagemUrl: 'https://img/lavanda.jpg',
  quantidade: 8,
  ativo: true,
};

describe('CarrinhoService', () => {
  let prisma: {
    carrinho: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    itemCarrinho: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    produto: { findMany: jest.Mock };
    pedido: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let enviarEmail: jest.Mock;
  let service: CarrinhoService;

  beforeEach(() => {
    prisma = {
      carrinho: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      itemCarrinho: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      produto: {
        findMany: jest.fn().mockResolvedValue([{ id: 10 }]),
      },
      pedido: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) =>
        Promise.all(ops),
      ),
    };
    enviarEmail = jest.fn();
    service = new CarrinhoService(
      prisma as unknown as PrismaService,
      { enviarEmail } as unknown as MailService,
      {
        get: (chave: string) => {
          if (chave === 'FRONTEND_URL') return 'https://www.sensorahome.com.br/';
          if (chave === 'LOJA_NOME') return 'Sensora';
          if (chave === 'CARRINHO_ABANDONO_MINUTOS') {
            return CARRINHO_ABANDONO_MINUTOS_PADRAO;
          }
          return undefined;
        },
      } as unknown as ConfigService,
    );
  });

  describe('buscar', () => {
    it('sem carrinho gravado: devolve itens vazios', async () => {
      await expect(service.buscar(7)).resolves.toEqual({ itens: [] });
    });

    it('omite produto inativo e devolve o snapshot do ativo', async () => {
      prisma.carrinho.findUnique.mockResolvedValueOnce({
        itens: [
          {
            produtoId: 10,
            quantidade: 2,
            produto: PRODUTO_LAVANDA,
          },
          {
            produtoId: 11,
            quantidade: 1,
            produto: { ...PRODUTO_LAVANDA, id: 11, ativo: false },
          },
        ],
      });

      await expect(service.buscar(7)).resolves.toEqual({
        itens: [
          {
            produtoId: 10,
            quantidade: 2,
            nome: 'Vela Lavanda',
            slug: 'vela-lavanda',
            preco: 59.9,
            imagemUrl: 'https://img/lavanda.jpg',
            estoqueConhecido: 8,
          },
        ],
      });
    });
  });

  describe('salvar', () => {
    it('primeiro PUT cria o carrinho com os itens válidos', async () => {
      prisma.carrinho.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          itens: [
            { produtoId: 10, quantidade: 2, produto: PRODUTO_LAVANDA },
          ],
        });

      const resultado = await service.salvar(7, {
        itens: [{ produtoId: 10, quantidade: 2 }],
      });

      expect(prisma.carrinho.create).toHaveBeenCalledWith({
        data: {
          usuarioId: 7,
          atualizadoEm: expect.any(Date),
          lembreteEnviadoEm: null,
          itens: { create: [{ produtoId: 10, quantidade: 2 }] },
        },
      });
      expect(resultado.itens).toHaveLength(1);
      expect(resultado.itens[0].produtoId).toBe(10);
    });

    it('PUT idêntico não mexe em atualizadoEm nem no lembrete', async () => {
      prisma.carrinho.findUnique.mockResolvedValue({
        id: 1,
        itens: [
          { produtoId: 10, quantidade: 2, produto: PRODUTO_LAVANDA },
        ],
      });

      await service.salvar(7, { itens: [{ produtoId: 10, quantidade: 2 }] });

      expect(prisma.carrinho.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.carrinho.update).not.toHaveBeenCalled();
    });

    it('mudança de itens substitui a lista e zera o lembrete', async () => {
      prisma.carrinho.findUnique
        .mockResolvedValueOnce({
          id: 1,
          itens: [{ produtoId: 10, quantidade: 1 }],
        })
        .mockResolvedValueOnce({
          itens: [
            { produtoId: 10, quantidade: 3, produto: PRODUTO_LAVANDA },
          ],
        });

      await service.salvar(7, { itens: [{ produtoId: 10, quantidade: 3 }] });

      expect(prisma.itemCarrinho.deleteMany).toHaveBeenCalledWith({
        where: { carrinhoId: 1 },
      });
      expect(prisma.itemCarrinho.createMany).toHaveBeenCalledWith({
        data: [{ carrinhoId: 1, produtoId: 10, quantidade: 3 }],
      });
      expect(prisma.carrinho.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          atualizadoEm: expect.any(Date),
          lembreteEnviadoEm: null,
        },
      });
    });

    it('produto inativo/inexistente é ignorado, não derruba o PUT', async () => {
      prisma.produto.findMany.mockResolvedValueOnce([]);
      prisma.carrinho.findUnique.mockResolvedValue(null);

      await expect(
        service.salvar(7, { itens: [{ produtoId: 99, quantidade: 1 }] }),
      ).resolves.toEqual({ itens: [] });

      expect(prisma.carrinho.create).not.toHaveBeenCalled();
    });

    it('PUT só com itens inválidos esvazia um carrinho que já existia', async () => {
      prisma.produto.findMany.mockResolvedValueOnce([]);
      prisma.carrinho.findUnique
        .mockResolvedValueOnce({
          id: 1,
          itens: [{ produtoId: 10, quantidade: 2 }],
        })
        .mockResolvedValueOnce({ itens: [] });

      await service.salvar(7, { itens: [{ produtoId: 99, quantidade: 1 }] });

      expect(prisma.itemCarrinho.deleteMany).toHaveBeenCalledWith({
        where: { carrinhoId: 1 },
      });
      expect(prisma.itemCarrinho.createMany).not.toHaveBeenCalled();
      expect(prisma.carrinho.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          atualizadoEm: expect.any(Date),
          lembreteEnviadoEm: null,
        },
      });
    });
  });

  describe('limparDoUsuario', () => {
    it('sem carrinho: no-op', async () => {
      await service.limparDoUsuario(7);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('esvazia os itens e zera o lembrete', async () => {
      prisma.carrinho.findUnique.mockResolvedValueOnce({ id: 4 });

      await service.limparDoUsuario(7);

      expect(prisma.itemCarrinho.deleteMany).toHaveBeenCalledWith({
        where: { carrinhoId: 4 },
      });
      expect(prisma.carrinho.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: {
          lembreteEnviadoEm: null,
          atualizadoEm: expect.any(Date),
        },
      });
    });

    it('falha no banco não lança', async () => {
      prisma.carrinho.findUnique.mockRejectedValueOnce(new Error('banco fora'));
      await expect(service.limparDoUsuario(7)).resolves.toBeUndefined();
    });
  });

  describe('enviarLembretes', () => {
    const carrinho = (id: number, extras: Record<string, unknown> = {}) => ({
      id,
      usuarioId: 7,
      usuario: { nome: 'Ana Souza', email: 'ana@sensora.dev' },
      itens: [
        { produto: { nome: 'Vela Lavanda', ativo: true } },
      ],
      ...extras,
    });

    it('marca antes e envia o e-mail com o link da sacola', async () => {
      prisma.carrinho.findMany.mockResolvedValueOnce([carrinho(1)]);

      await service.enviarLembretes();

      const filtro = primeiraChamada(prisma.carrinho.findMany) as {
        where: {
          lembreteEnviadoEm: null;
          atualizadoEm: { lte: Date };
        };
      };
      expect(filtro.where.lembreteEnviadoEm).toBeNull();
      const minutos =
        (Date.now() - filtro.where.atualizadoEm.lte.getTime()) / 60_000;
      expect(Math.round(minutos)).toBe(CARRINHO_ABANDONO_MINUTOS_PADRAO);
      expect(prisma.carrinho.updateMany).toHaveBeenCalledTimes(1);
      expect(enviarEmail).toHaveBeenCalledTimes(1);
      const email = primeiraChamada(enviarEmail) as {
        to: string;
        subject: string;
        html: string;
      };
      expect(email.to).toBe('ana@sensora.dev');
      expect(email.subject).toContain('sacola');
      expect(email.html).toContain('Vela Lavanda');
      expect(email.html).toContain(
        'https://www.sensorahome.com.br/loja/carrinho',
      );
    });

    it('pedido PENDENTE: não marca nem envia (cliente já está no pagamento)', async () => {
      prisma.carrinho.findMany.mockResolvedValueOnce([carrinho(1)]);
      prisma.pedido.findFirst.mockResolvedValueOnce({ id: 90 });

      await service.enviarLembretes();

      expect(prisma.carrinho.updateMany).not.toHaveBeenCalled();
      expect(enviarEmail).not.toHaveBeenCalled();
    });

    it('outra máquina já marcou: não envia de novo', async () => {
      prisma.carrinho.findMany.mockResolvedValueOnce([carrinho(1)]);
      prisma.carrinho.updateMany.mockResolvedValueOnce({ count: 0 });

      await service.enviarLembretes();

      expect(enviarEmail).not.toHaveBeenCalled();
    });

    it('só produtos inativos: marca para sair da busca, sem e-mail', async () => {
      prisma.carrinho.findMany.mockResolvedValueOnce([
        carrinho(1, {
          itens: [{ produto: { nome: 'Fora de linha', ativo: false } }],
        }),
      ]);

      await service.enviarLembretes();

      expect(prisma.carrinho.updateMany).toHaveBeenCalledTimes(1);
      expect(enviarEmail).not.toHaveBeenCalled();
    });

    it('falha na busca não lança', async () => {
      prisma.carrinho.findMany.mockRejectedValueOnce(new Error('banco fora'));
      await expect(service.enviarLembretes()).resolves.toBeUndefined();
    });
  });
});
