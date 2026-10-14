import { ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProdutoDto,
  MAXIMO_IMAGENS_PRODUTO,
} from './dto/create-produto.dto';
import { ProdutosService } from './produtos.service';

// Galeria de fotos: a capa (imagemUrl) acompanha sempre a 1ª de `imagens`.
describe('ProdutosService — galeria de imagens', () => {
  const registro = {
    id: 1,
    nome: 'Vela',
    slug: 'vela',
    descricao: null,
    aroma: null,
    imagemUrl: '/a.jpg',
    imagens: ['/a.jpg'],
    ativo: true,
    destaque: false,
    categoriaId: null,
    preco: 10,
    quantidade: 1,
  };
  let prisma: {
    produto: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
  };
  let service: ProdutosService;

  beforeEach(() => {
    prisma = {
      produto: {
        create: jest.fn(({ data }: { data: object }) => ({
          ...registro,
          ...data,
        })),
        update: jest.fn(({ data }: { data: object }) => ({
          ...registro,
          ...data,
        })),
        // findOne do update acha o produto; no create, o slug está livre.
        findUnique: jest.fn(({ where }: { where: { id?: number } }) =>
          where.id ? registro : null,
        ),
      },
    };
    service = new ProdutosService(prisma as unknown as PrismaService);
  });

  const base = { nome: 'Vela', preco: 10, quantidade: 1 };

  it('cria com galeria: a capa é a 1ª foto', async () => {
    const produto = await service.create({
      ...base,
      imagens: ['/b.jpg', '/c.jpg'],
    });

    expect(prisma.produto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        imagens: ['/b.jpg', '/c.jpg'],
        imagemUrl: '/b.jpg',
      }) as object,
    });
    expect(produto).toMatchObject({
      imagemUrl: '/b.jpg',
      imagens: ['/b.jpg', '/c.jpg'],
    });
  });

  it('reordenar a galeria troca a capa; galeria vazia tira a capa', async () => {
    await service.update(1, { imagens: ['/c.jpg', '/b.jpg'] });
    expect(prisma.produto.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { imagens: ['/c.jpg', '/b.jpg'], imagemUrl: '/c.jpg' },
    });

    await service.update(1, { imagens: [] });
    expect(prisma.produto.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { imagens: [], imagemUrl: null },
    });
  });

  it('cliente antigo (só imagemUrl): a galeria vira essa foto', async () => {
    await service.update(1, { imagemUrl: '/d.jpg' });
    expect(prisma.produto.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { imagemUrl: '/d.jpg', imagens: ['/d.jpg'] },
    });
  });

  it('sem imagemUrl nem imagens, as fotos não mudam', async () => {
    await service.update(1, { preco: 20 });
    expect(prisma.produto.update).toHaveBeenLastCalledWith({
      where: { id: 1 },
      data: { preco: 20 },
    });
  });

  it(`DTO recusa mais de ${MAXIMO_IMAGENS_PRODUTO} fotos e URL inválida`, async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const validar = (imagens: string[]) =>
      pipe.transform(
        { ...base, imagens },
        { type: 'body', metatype: CreateProdutoDto },
      );

    await expect(
      validar(Array.from({ length: MAXIMO_IMAGENS_PRODUTO }, () => '/x.jpg')),
    ).resolves.toBeDefined();
    await expect(
      validar(
        Array.from({ length: MAXIMO_IMAGENS_PRODUTO + 1 }, () => '/x.jpg'),
      ),
    ).rejects.toBeDefined();
    await expect(validar(['javascript:alert(1)'])).rejects.toBeDefined();
  });
});
