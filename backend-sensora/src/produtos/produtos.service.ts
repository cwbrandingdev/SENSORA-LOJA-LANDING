import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Produto as ProdutoPrisma } from '../../generated/prisma/client';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { Produto } from './entities/produto.entity';

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Produto[]> {
    const produtos = await this.prisma.produto.findMany();
    return produtos.map((produto) => this.paraProduto(produto));
  }

  async findOne(id: number): Promise<Produto> {
    const produto = await this.prisma.produto.findUnique({ where: { id } });
    if (!produto) {
      throw new NotFoundException(`Produto com id ${id} não encontrado`);
    }
    return this.paraProduto(produto);
  }

  async create(createProdutoDto: CreateProdutoDto): Promise<Produto> {
    if (createProdutoDto.categoriaId !== undefined) {
      await this.validarCategoriaExiste(createProdutoDto.categoriaId);
    }
    const slug = await this.gerarSlugUnico(createProdutoDto.nome);
    const produto = await this.prisma.produto.create({
      data: { ...createProdutoDto, slug },
    });
    return this.paraProduto(produto);
  }

  async update(
    id: number,
    updateProdutoDto: UpdateProdutoDto,
  ): Promise<Produto> {
    await this.findOne(id);
    if (updateProdutoDto.categoriaId !== undefined) {
      await this.validarCategoriaExiste(updateProdutoDto.categoriaId);
    }
    const produto = await this.prisma.produto.update({
      where: { id },
      data: updateProdutoDto,
    });
    return this.paraProduto(produto);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);

    // Sem isso, o Postgres rejeita a exclusão com uma violação de FK bruta
    // (500) sempre que o produto está referenciado em algum ItemPedido — a
    // relação é obrigatória e sem onDelete no Prisma. Reproduzido com dados
    // descartáveis antes desta correção (complemento da Etapa 9), mesma
    // classe de bug já corrigida para Categoria na Etapa 8.
    const itensVinculados = await this.prisma.itemPedido.count({
      where: { produtoId: id },
    });
    if (itensVinculados > 0) {
      throw new ConflictException(
        'Não é possível excluir este produto porque ele está vinculado a pedidos existentes.',
      );
    }

    await this.prisma.produto.delete({ where: { id } });
  }

  async verificarEstoque(
    produtoId: number,
    quantidade: number,
  ): Promise<boolean> {
    const produto = await this.findOne(produtoId);
    return produto.quantidade >= quantidade;
  }

  // Achado da auditoria (race condition / overselling): a checagem "tem
  // estoque suficiente?" e o decremento agora são uma única operação
  // condicional no banco (updateMany com `quantidade: { gte: quantidade }`
  // no where), em vez da sequência SELECT-depois-UPDATE anterior. Duas
  // chamadas concorrentes para o mesmo produto não conseguem mais passar
  // ambas pela checagem antes de qualquer uma escrever — a segunda sempre
  // vê o resultado já decrementado da primeira, porque o próprio Postgres
  // resolve a condição de corrida na cláusula WHERE do UPDATE.
  //
  // Task 15 (webhook Stripe): parâmetro `client` opcional — default
  // `this.prisma` preserva 100% o comportamento e as chamadas existentes.
  // Quando o chamador está dentro de um `prisma.$transaction(async (tx) =>
  // ...)` (ex.: CheckoutService confirmando pagamento + baixando estoque
  // como uma única operação atômica), passa `tx` aqui para que a baixa
  // participe da mesma transação — sem duplicar esta lógica de decremento
  // em outro lugar.
  async removerEstoque(
    produtoId: number,
    quantidade: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Produto> {
    const resultado = await client.produto.updateMany({
      where: { id: produtoId, quantidade: { gte: quantidade } },
      data: { quantidade: { decrement: quantidade } },
    });

    if (resultado.count === 0) {
      // count === 0 significa "produto não existe" OU "existe mas não tem
      // estoque suficiente" — findOne (sempre via this.prisma, nunca via
      // `client`) só serve para escolher a exceção certa a lançar; se
      // `client` for uma transação que ainda vai reverter, essa leitura
      // fora dela não interfere em nenhum estado.
      await this.findOne(produtoId);
      throw new BadRequestException(
        `Estoque insuficiente para o produto com id ${produtoId}`,
      );
    }

    const produtoAtualizado = await client.produto.findUnique({
      where: { id: produtoId },
    });
    return this.paraProduto(produtoAtualizado!);
  }

  // Etapa 5A (Cancelamento de Pedido) — mesmo raciocínio de removerEstoque
  // logo acima: `client` opcional participa de uma transação já aberta pelo
  // chamador (ex.: PedidosService.cancelar restaurando estoque + mudando
  // status como uma única operação atômica) sem duplicar esta lógica de
  // incremento em outro lugar. Default `this.prisma` preserva 100% as
  // chamadas existentes (ItensPedidoService).
  async adicionarEstoque(
    produtoId: number,
    quantidade: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Produto> {
    await this.findOne(produtoId);
    const atualizado = await client.produto.update({
      where: { id: produtoId },
      data: { quantidade: { increment: quantidade } },
    });
    return this.paraProduto(atualizado);
  }

  private paraProduto(produto: ProdutoPrisma): Produto {
    return {
      id: produto.id,
      nome: produto.nome,
      slug: produto.slug,
      descricao: produto.descricao ?? undefined,
      aroma: produto.aroma ?? undefined,
      imagemUrl: produto.imagemUrl ?? undefined,
      ativo: produto.ativo,
      categoriaId: produto.categoriaId ?? undefined,
      preco: Number(produto.preco),
      quantidade: produto.quantidade,
      destaque: produto.destaque,
    };
  }

  private async validarCategoriaExiste(categoriaId: number): Promise<void> {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id: categoriaId },
    });
    if (!categoria) {
      throw new NotFoundException(
        `Categoria com id ${categoriaId} não encontrada`,
      );
    }
  }

  private gerarSlugBase(nome: string): string {
    const base = nome
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || 'produto';
  }

  private async gerarSlugUnico(nome: string): Promise<string> {
    const base = this.gerarSlugBase(nome);
    let slug = base;
    let sufixo = 2;
    while (await this.prisma.produto.findUnique({ where: { slug } })) {
      slug = `${base}-${sufixo}`;
      sufixo += 1;
    }
    return slug;
  }
}
