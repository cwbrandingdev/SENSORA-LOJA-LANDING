import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ItemPedido as ItemPedidoPrisma } from '../../generated/prisma/client';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { PedidosService } from '../pedidos/pedidos.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../produtos/produtos.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { CreateItemPedidoDto } from './dto/create-item-pedido.dto';
import { UpdateItemPedidoDto } from './dto/update-item-pedido.dto';
import { ItemPedido } from './entities/item-pedido.entity';

@Injectable()
export class ItensPedidoService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PedidosService))
    private readonly pedidosService: PedidosService,
    private readonly produtosService: ProdutosService,
  ) {}

  // Etapa 10 / Task 5 (achado A6): ItemPedido não tem usuarioId próprio,
  // mas pertence a um Pedido que tem — filtra pela relação `pedido` que já
  // existe no schema (ItemPedido.pedido), sem precisar de coluna nova.
  async findAll(user: UsuarioAutenticado): Promise<ItemPedido[]> {
    const where =
      user.perfil === PerfilUsuario.ADMIN
        ? {}
        : { pedido: { usuarioId: user.id } };
    const itens = await this.prisma.itemPedido.findMany({ where });
    return itens.map((item) => this.paraItemPedido(item));
  }

  async findByPedidoId(pedidoId: number): Promise<ItemPedido[]> {
    const itens = await this.prisma.itemPedido.findMany({
      where: { pedidoId },
    });
    return itens.map((item) => this.paraItemPedido(item));
  }

  async findOne(id: number, user: UsuarioAutenticado): Promise<ItemPedido> {
    return this.paraItemPedido(await this.localizar(id, user));
  }

  async create(
    createItemPedidoDto: CreateItemPedidoDto,
    user: UsuarioAutenticado,
  ): Promise<ItemPedido> {
    const { pedidoId, produtoId, quantidade, precoUnitario } =
      createItemPedidoDto;

    // Reaproveita a checagem de propriedade do pedido — se o VENDEDOR não
    // for dono de `pedidoId`, findOne já lança NotFoundException aqui.
    const pedido = await this.pedidosService.findOne(pedidoId, user);
    // Achado da auditoria: não é possível adicionar item a um pedido já
    // finalizado (PAGO/CANCELADO) — checado antes de qualquer verificação/
    // baixa de estoque.
    this.pedidosService.garantirMutavel(pedido);
    await this.produtosService.findOne(produtoId);

    // Achado da auditoria (race condition): o decremento é feito ANTES de
    // criar o item, e é a própria chamada atômica (ver
    // ProdutosService.removerEstoque) que decide se há estoque suficiente —
    // lança BadRequestException e nada mais acontece se não houver. Isso
    // evita criar um ItemPedido "órfão" sem estoque reservado, o que
    // aconteceria se o item fosse criado antes do decremento.
    await this.produtosService.removerEstoque(produtoId, quantidade);

    // Etapa 5A.2 (achado da auditoria 5A.1) — marca o item como
    // estoqueBaixado:true só depois do decremento acima ter dado certo
    // (removerEstoque já lançou BadRequestException e nada abaixo executa
    // se não houvesse estoque suficiente) — nunca criado com o estoque
    // ainda "no ar". É este flag, não a origem do Pedido, que
    // PedidosService.cancelar() usa para decidir se restaura estoque.
    const item = await this.prisma.itemPedido.create({
      data: {
        pedidoId,
        produtoId,
        quantidade,
        precoUnitario,
        subtotal: quantidade * precoUnitario,
        estoqueBaixado: true,
      },
    });

    return this.paraItemPedido(item);
  }

  async update(
    id: number,
    updateItemPedidoDto: UpdateItemPedidoDto,
    user: UsuarioAutenticado,
  ): Promise<ItemPedido> {
    const item = await this.localizar(id, user);

    // Achado da auditoria: item de pedido já finalizado (PAGO/CANCELADO) não
    // pode ser alterado — checado antes de qualquer ajuste de estoque.
    const pedidoAtual = await this.pedidosService.findOne(item.pedidoId, user);
    this.pedidosService.garantirMutavel(pedidoAtual);

    if (updateItemPedidoDto.pedidoId !== undefined) {
      // Também impede mover o item para um pedido de outro vendedor —
      // findOne lança 404 se o pedido de destino não estiver no escopo — e
      // para um pedido de destino já finalizado.
      const pedidoDestino = await this.pedidosService.findOne(
        updateItemPedidoDto.pedidoId,
        user,
      );
      this.pedidosService.garantirMutavel(pedidoDestino);
    }

    const produtoIdAntigo = item.produtoId;
    const quantidadeAntiga = item.quantidade;
    const novoProdutoId = updateItemPedidoDto.produtoId ?? produtoIdAntigo;
    const novaQuantidade = updateItemPedidoDto.quantidade ?? quantidadeAntiga;

    // Achado da auditoria (race condition): as checagens de estoque via
    // verificarEstoque() antes de cada ajuste foram removidas — a decisão
    // "tem estoque suficiente?" agora é feita atomicamente dentro do próprio
    // removerEstoque() (ver ProdutosService), que lança BadRequestException
    // se não houver. A matemática de diferença entre quantidade antiga/nova
    // é a mesma de antes, só a forma de aplicar o decremento mudou.
    if (novoProdutoId !== produtoIdAntigo) {
      await this.produtosService.findOne(novoProdutoId);

      await this.produtosService.adicionarEstoque(
        produtoIdAntigo,
        quantidadeAntiga,
      );
      await this.produtosService.removerEstoque(novoProdutoId, novaQuantidade);
    } else if (novaQuantidade !== quantidadeAntiga) {
      const diferenca = novaQuantidade - quantidadeAntiga;

      if (diferenca > 0) {
        await this.produtosService.removerEstoque(produtoIdAntigo, diferenca);
      } else {
        await this.produtosService.adicionarEstoque(
          produtoIdAntigo,
          -diferenca,
        );
      }
    }

    const precoUnitarioFinal =
      updateItemPedidoDto.precoUnitario ?? Number(item.precoUnitario);

    const atualizado = await this.prisma.itemPedido.update({
      where: { id },
      data: {
        ...updateItemPedidoDto,
        subtotal: novaQuantidade * precoUnitarioFinal,
      },
    });

    return this.paraItemPedido(atualizado);
  }

  async remove(id: number, user: UsuarioAutenticado): Promise<void> {
    const item = await this.localizar(id, user);

    // Achado da auditoria: item de pedido já finalizado (PAGO/CANCELADO) não
    // pode ser removido — checado antes de devolver estoque/excluir.
    const pedido = await this.pedidosService.findOne(item.pedidoId, user);
    this.pedidosService.garantirMutavel(pedido);

    await this.produtosService.adicionarEstoque(
      item.produtoId,
      item.quantidade,
    );
    await this.prisma.itemPedido.delete({ where: { id } });
  }

  // Único ponto que resolve um ItemPedido por id — reforça a checagem de
  // propriedade via o pedido pai (pedidosService.findOne), então GET/PUT/
  // DELETE /itens-pedido/:id não podem ser usados para contornar o escopo
  // do VENDEDOR mesmo sabendo o id do item diretamente.
  private async localizar(
    id: number,
    user: UsuarioAutenticado,
  ): Promise<ItemPedidoPrisma> {
    const item = await this.prisma.itemPedido.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Item de pedido com id ${id} não encontrado`);
    }
    await this.pedidosService.findOne(item.pedidoId, user);
    return item;
  }

  private paraItemPedido(item: ItemPedidoPrisma): ItemPedido {
    return {
      id: item.id,
      pedidoId: item.pedidoId,
      produtoId: item.produtoId,
      quantidade: item.quantidade,
      precoUnitario: Number(item.precoUnitario),
      subtotal: Number(item.subtotal),
    };
  }
}
