import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Categoria as CategoriaPrisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { Categoria } from './entities/categoria.entity';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Categoria[]> {
    const categorias = await this.prisma.categoria.findMany();
    return categorias.map((categoria) => this.paraCategoria(categoria));
  }

  async findOne(id: number): Promise<Categoria> {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id },
    });
    if (!categoria) {
      throw new NotFoundException(`Categoria com id ${id} não encontrada`);
    }
    return this.paraCategoria(categoria);
  }

  async create(createCategoriaDto: CreateCategoriaDto): Promise<Categoria> {
    const slug = await this.gerarSlugUnico(createCategoriaDto.nome);
    const categoria = await this.prisma.categoria.create({
      data: { ...createCategoriaDto, slug },
    });
    return this.paraCategoria(categoria);
  }

  async update(
    id: number,
    updateCategoriaDto: UpdateCategoriaDto,
  ): Promise<Categoria> {
    await this.findOne(id);
    const categoria = await this.prisma.categoria.update({
      where: { id },
      data: updateCategoriaDto,
    });
    return this.paraCategoria(categoria);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);

    // Sem isso, a exclusão apaga a categoria silenciosamente e o Postgres
    // aplica o default da FK (SetNull), deixando os produtos vinculados
    // órfãos sem nenhum aviso — reproduzido com dados descartáveis antes
    // desta correção (Etapa 8).
    const produtosVinculados = await this.prisma.produto.count({
      where: { categoriaId: id },
    });
    if (produtosVinculados > 0) {
      throw new ConflictException(
        'Não é possível excluir esta categoria porque existem produtos vinculados a ela.',
      );
    }

    await this.prisma.categoria.delete({ where: { id } });
  }

  private paraCategoria(categoria: CategoriaPrisma): Categoria {
    return {
      id: categoria.id,
      nome: categoria.nome,
      slug: categoria.slug,
      descricao: categoria.descricao ?? undefined,
    };
  }

  private gerarSlugBase(nome: string): string {
    const base = nome
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || 'categoria';
  }

  private async gerarSlugUnico(nome: string): Promise<string> {
    const base = this.gerarSlugBase(nome);
    let slug = base;
    let sufixo = 2;
    while (await this.prisma.categoria.findUnique({ where: { slug } })) {
      slug = `${base}-${sufixo}`;
      sufixo += 1;
    }
    return slug;
  }
}
