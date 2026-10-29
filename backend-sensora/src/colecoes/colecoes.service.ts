import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateColecaoDto } from './dto/create-colecao.dto';
import { UpdateColecaoDto } from './dto/update-colecao.dto';
import { Colecao } from './entities/colecao.entity';

// Só os ids dos produtos — o Admin já tem a lista completa de produtos.
const COM_PRODUTO_IDS = { produtos: { select: { id: true } } } as const;

type ColecaoComProdutoIds = {
  id: number;
  nome: string;
  slug: string;
  chamada: string | null;
  titulo: string | null;
  descricao: string | null;
  imagemUrl: string | null;
  ativo: boolean;
  produtos: { id: number }[];
};

@Injectable()
export class ColecoesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Colecao[]> {
    const colecoes = await this.prisma.colecao.findMany({
      include: COM_PRODUTO_IDS,
      orderBy: { nome: 'asc' },
    });
    return colecoes.map((colecao) => this.paraColecao(colecao));
  }

  async findOne(id: number): Promise<Colecao> {
    const colecao = await this.prisma.colecao.findUnique({
      where: { id },
      include: COM_PRODUTO_IDS,
    });
    if (!colecao) {
      throw new NotFoundException(`Coleção com id ${id} não encontrada`);
    }
    return this.paraColecao(colecao);
  }

  async create(dto: CreateColecaoDto): Promise<Colecao> {
    const { produtoIds = [], ...dados } = dto;
    await this.validarProdutosExistem(produtoIds);
    const slug = await this.gerarSlugUnico(dto.nome);
    const colecao = await this.prisma.colecao.create({
      data: {
        ...dados,
        slug,
        produtos: { connect: produtoIds.map((id) => ({ id })) },
      },
      include: COM_PRODUTO_IDS,
    });
    return this.paraColecao(colecao);
  }

  async update(id: number, dto: UpdateColecaoDto): Promise<Colecao> {
    await this.findOne(id);
    const { produtoIds, ...dados } = dto;

    // Sem `produtoIds`, os produtos da coleção não mudam (ex.: só ligar/desligar).
    let produtos = {};
    if (produtoIds !== undefined) {
      await this.validarProdutosExistem(produtoIds);
      produtos = { set: produtoIds.map((produtoId) => ({ id: produtoId })) };
    }

    const colecao = await this.prisma.colecao.update({
      where: { id },
      data: { ...dados, produtos },
      include: COM_PRODUTO_IDS,
    });
    return this.paraColecao(colecao);
  }

  // Apaga só a coleção: os produtos continuam na loja, na categoria deles.
  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.prisma.colecao.delete({ where: { id } });
  }

  private async validarProdutosExistem(produtoIds: number[]): Promise<void> {
    const encontrados = await this.prisma.produto.count({
      where: { id: { in: produtoIds } },
    });
    if (encontrados !== new Set(produtoIds).size) {
      throw new BadRequestException(
        'Algum dos produtos escolhidos não existe mais.',
      );
    }
  }

  private paraColecao(colecao: ColecaoComProdutoIds): Colecao {
    return {
      id: colecao.id,
      nome: colecao.nome,
      slug: colecao.slug,
      chamada: colecao.chamada ?? undefined,
      titulo: colecao.titulo ?? undefined,
      descricao: colecao.descricao ?? undefined,
      imagemUrl: colecao.imagemUrl ?? undefined,
      ativo: colecao.ativo,
      produtoIds: colecao.produtos.map((produto) => produto.id),
    };
  }

  private gerarSlugBase(nome: string): string {
    const base = nome
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || 'colecao';
  }

  private async gerarSlugUnico(nome: string): Promise<string> {
    const base = this.gerarSlugBase(nome);
    let slug = base;
    let sufixo = 2;
    while (await this.prisma.colecao.findUnique({ where: { slug } })) {
      slug = `${base}-${sufixo}`;
      sufixo += 1;
    }
    return slug;
  }
}
