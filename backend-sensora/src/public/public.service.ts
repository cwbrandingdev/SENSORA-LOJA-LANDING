import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Categoria as CategoriaPrisma,
  Colecao as ColecaoPrisma,
  Produto as ProdutoPrisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriaPublica } from './entities/categoria-publica.entity';
import {
  ColecaoPublica,
  ColecaoPublicaComProdutos,
} from './entities/colecao-publica.entity';
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

  // Só as coleções ligadas no Admin — desligada some do menu e da loja.
  async listarColecoes(): Promise<ColecaoPublica[]> {
    const colecoes = await this.prisma.colecao.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });
    return colecoes.map((colecao) => this.paraColecaoPublica(colecao));
  }

  async buscarColecaoPorSlug(slug: string): Promise<ColecaoPublicaComProdutos> {
    const colecao = await this.prisma.colecao.findUnique({
      where: { slug },
      include: {
        produtos: {
          where: { ativo: true },
          include: { categoria: true },
          orderBy: [{ destaque: 'desc' }, { nome: 'asc' }],
        },
      },
    });

    if (!colecao || !colecao.ativo) {
      throw new NotFoundException(`Coleção "${slug}" não encontrada`);
    }

    return {
      ...this.paraColecaoPublica(colecao),
      produtos: colecao.produtos.map((produto) =>
        this.paraProdutoPublico(produto),
      ),
    };
  }

  private paraProdutoPublico(produto: ProdutoComCategoria): ProdutoPublico {
    return {
      id: produto.id,
      nome: produto.nome,
      slug: produto.slug,
      descricao: produto.descricao ?? undefined,
      preco: Number(produto.preco),
      imagemUrl: produto.imagemUrl ?? undefined,
      imagens: produto.imagens,
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

  private paraColecaoPublica(colecao: ColecaoPrisma): ColecaoPublica {
    return {
      id: colecao.id,
      nome: colecao.nome,
      slug: colecao.slug,
      descricao: colecao.descricao ?? undefined,
      imagemUrl: colecao.imagemUrl ?? undefined,
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
