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
    //
    // A leitura do preço do novo produto (quando o produto do item muda)
    // continua fora da transação — é só consulta, não escreve nada, mesmo
    // comportamento de sempre; só os ajustes de ESTOQUE (que escrevem) se
    // moveram para dentro do $transaction abaixo (Etapa 10 / PED-01).
    if (novoProdutoId !== produtoIdAntigo) {
      const novoProduto = await this.produtosService.findOne(novoProdutoId);
      precoUnitarioFinal = novoProduto.preco;
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

    // Etapa 10 / PED-01 (achado da auditoria — estoque fora da transação):
    // antes, os ajustes de estoque abaixo rodavam em autocommit, ANTES de
    // abrir este $transaction — se a escrita do item ou o recálculo do
    // total falhassem depois, o estoque já alterado não era revertido.
    // removerEstoque()/adicionarEstoque() já aceitavam um `client` opcional
    // (ver ProdutosService, usado por CheckoutService/PedidosService da
    // mesma forma), então basta passar `tx` aqui — mesma lógica, mesma
    // matemática, mesma proteção contra estoque insuficiente (atômica
    // dentro do próprio removerEstoque), só agora participando do mesmo
    // contexto transacional que o resto da operação.
    const atualizado = await this.prisma.$transaction(async (tx) => {
      if (novoProdutoId !== produtoIdAntigo) {
        await this.produtosService.adicionarEstoque(
          produtoIdAntigo,
          quantidadeAntiga,
          tx,
        );
        await this.produtosService.removerEstoque(
          novoProdutoId,
          novaQuantidade,
          tx,
        );
      } else if (novaQuantidade !== quantidadeAntiga) {
        const diferenca = novaQuantidade - quantidadeAntiga;

        if (diferenca > 0) {
          await this.produtosService.removerEstoque(
            produtoIdAntigo,
            diferenca,
            tx,
          );
        } else {
          await this.produtosService.adicionarEstoque(
            produtoIdAntigo,
            -diferenca,
            tx,
          );
        }
      }

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

    // Etapa 10 / PED-01 (mesmo achado/correção de update() acima) —
    // devolução de estoque, exclusão do item e recálculo de Pedido.total
    // agora na MESMA transação: antes, adicionarEstoque() rodava em
    // autocommit antes de abrir o $transaction — se a exclusão ou o
    // recálculo falhassem depois, o estoque já devolvido não era revertido.
    await this.prisma.$transaction(async (tx) => {
      await this.produtosService.adicionarEstoque(
        item.produtoId,
        item.quantidade,
        tx,
      );
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
