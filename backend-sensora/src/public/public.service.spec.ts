import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PublicService } from './public.service';

// Etapa 6.6 (aviso de estoque) — prova que PublicService passa
// Produto.quantidade adiante em ProdutoPublico, para todos os patamares
// usados pela UX do frontend (esgotado, última unidade, poucas unidades,
// estoque normal). Não testa a UI (isso é coberto pelos specs de frontend em
// e2e/), só o contrato de dados que ela consome.
describe('PublicService — quantidade em ProdutoPublico (Etapa 6.6)', () => {
  let service: PublicService;
  let findMany: jest.Mock;
  let findUnique: jest.Mock;

  function produtoBase(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 1,
      nome: 'Vela Aromática Lavanda',
      slug: 'vela-aromatica-lavanda',
      descricao: null,
      preco: 59.9,
      imagemUrl: null,
      aroma: null,
      destaque: false,
      ativo: true,
      categoriaId: null,
      categoria: null,
      quantidade: 0,
      ...overrides,
    };
  }

  beforeEach(async () => {
    findMany = jest.fn();
    findUnique = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        {
          provide: PrismaService,
          useValue: { produto: { findMany, findUnique } },
        },
      ],
    }).compile();

    service = module.get(PublicService);
  });

  it.each([0, 1, 2, 5, 6, 10])(
    'listarProdutos: repassa quantidade=%i sem transformação',
    async (quantidade) => {
      findMany.mockResolvedValue([produtoBase({ quantidade })]);

      const [produto] = await service.listarProdutos();

      expect(produto.quantidade).toBe(quantidade);
    },
  );

  it.each([0, 1, 2, 5, 6, 10])(
    'buscarProdutoPorSlug: repassa quantidade=%i sem transformação',
    async (quantidade) => {
      findUnique.mockResolvedValue(produtoBase({ quantidade }));

      const produto = await service.buscarProdutoPorSlug('vela-aromatica-lavanda');

      expect(produto.quantidade).toBe(quantidade);
    },
  );

  it('buscarProdutoPorSlug: produto inativo continua retornando 404, independente do estoque', async () => {
    findUnique.mockResolvedValue(produtoBase({ ativo: false, quantidade: 10 }));

    await expect(service.buscarProdutoPorSlug('vela-aromatica-lavanda')).rejects.toThrow(
      NotFoundException,
    );
  });
});
