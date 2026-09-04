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

  // Etapa 8.1 (complemento — eliminação da venda manual) — create() foi
  // removido de propósito: não existe mais montagem administrativa de
  // venda item a item. Os itens de um Pedido nascem exclusivamente dentro
  // de CheckoutService.createSession (gravados via Prisma junto com o
  // próprio Pedido, nunca por aqui). Este service agora só gerencia itens
  // já existentes de um pedido ainda PENDENTE.

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

    // Achado da auditoria (HIGH-01): precoUnitario nunca vem do cliente
    // (nem UpdateItemPedidoDto tem mais este campo). Se o produto do item
    // não muda, o preço já confiável gravado em `item.precoUnitario`
    // (definido a partir do Produto real na criação) é preservado; se o
    // produto muda, o novo preço é sempre o preço ATUAL do novo Produto —
    // nunca um valor arbitrário.
    let precoUnitarioFinal = Number(item.precoUnitario);

    // Achado da auditoria (race condition): as checagens de estoque via
    // verificarEstoque() antes de cada ajuste foram removidas — a decisão
    // "tem estoque suficiente?" agora é feita atomicamente dentro do próprio
    // removerEstoque() (ver ProdutosService), que lança BadRequestException
    // se não houver. A matemática de diferença entre quantidade antiga/nova
    // é a mesma de antes, só a forma de aplicar o decremento mudou.
    if (novoProdutoId !== produtoIdAntigo) {
      const novoProduto = await this.produtosService.findOne(novoProdutoId);
      precoUnitarioFinal = novoProduto.preco;

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

    // Etapa 8.8 (integridade financeira) — `pedidoId` pode mudar aqui
    // (mover o item para outro pedido, ambos já validados como mutáveis
    // acima), então até dois Pedido.total precisam ficar consistentes com
    // os itens que cada um passa a ter. A escrita do item e o(s)
    // recálculo(s) de total acontecem na MESMA transação: sem isso, duas
    // edições concorrentes no mesmo pedido poderiam intercalar leitura/
    // escrita do total e perder um dos recálculos (lost update).
    const pedidoOrigemId = item.pedidoId;
    const pedidoDestinoId = updateItemPedidoDto.pedidoId ?? pedidoOrigemId;

    const atualizado = await this.prisma.$transaction(async (tx) => {
      const itemAtualizado = await tx.itemPedido.update({
        where: { id },
        data: {
          ...updateItemPedidoDto,
          precoUnitario: precoUnitarioFinal,
          subtotal: novaQuantidade * precoUnitarioFinal,
        },
      });

      await this.pedidosService.recalcularTotal(pedidoDestinoId, tx);
      if (pedidoDestinoId !== pedidoOrigemId) {
        await this.pedidosService.recalcularTotal(pedidoOrigemId, tx);
      }

      return itemAtualizado;
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

    // Etapa 8.8 (integridade financeira) — exclusão do item e recálculo de
    // Pedido.total na mesma transação (mesmo raciocínio de update() acima).
    await this.prisma.$transaction(async (tx) => {
      await tx.itemPedido.delete({ where: { id } });
      await this.pedidosService.recalcularTotal(item.pedidoId, tx);
    });
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
