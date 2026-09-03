import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Categoria as CategoriaPrisma,
  Produto as ProdutoPrisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriaPublica } from './entities/categoria-publica.entity';
import { ProdutoPublico } from './entities/produto-publico.entity';

type ProdutoComCategoria = ProdutoPrisma & {
  categoria: CategoriaPrisma | null;
};

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async listarProdutos(): Promise<ProdutoPublico[]> {
    const produtos = await this.prisma.produto.findMany({
      where: { ativo: true },
      include: { categoria: true },
      orderBy: [{ destaque: 'desc' }, { nome: 'asc' }],
    });
    return produtos.map((produto) => this.paraProdutoPublico(produto));
  }

  async buscarProdutoPorSlug(slug: string): Promise<ProdutoPublico> {
    const produto = await this.prisma.produto.findUnique({
      where: { slug },
      include: { categoria: true },
    });

    if (!produto || !produto.ativo) {
      throw new NotFoundException(`Produto "${slug}" não encontrado`);
    }

    return this.paraProdutoPublico(produto);
  }

  async listarCategorias(): Promise<CategoriaPublica[]> {
    const categorias = await this.prisma.categoria.findMany({
      orderBy: { nome: 'asc' },
    });
    return categorias.map((categoria) => this.paraCategoriaPublica(categoria));
  }

  private paraProdutoPublico(produto: ProdutoComCategoria): ProdutoPublico {
    return {
      id: produto.id,
      nome: produto.nome,
      slug: produto.slug,
      descricao: produto.descricao ?? undefined,
      preco: Number(produto.preco),
      imagemUrl: produto.imagemUrl ?? undefined,
      aroma: produto.aroma ?? undefined,
      destaque: produto.destaque,
      categoriaId: produto.categoriaId ?? undefined,
      categoria: produto.categoria
        ? this.paraCategoriaResumo(produto.categoria)
        : undefined,
      quantidade: produto.quantidade,
    };
  }

  private paraCategoriaResumo(categoria: CategoriaPrisma) {
    return {
      id: categoria.id,
      nome: categoria.nome,
      slug: categoria.slug,
    };
  }

  private paraCategoriaPublica(categoria: CategoriaPrisma): CategoriaPublica {
    return {
      id: categoria.id,
      nome: categoria.nome,
      slug: categoria.slug,
      descricao: categoria.descricao ?? undefined,
    };
  }
}
