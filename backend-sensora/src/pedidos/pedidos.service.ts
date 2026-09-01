import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pedido as PedidoPrisma } from '../../generated/prisma/client';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ItemPedido } from '../itens-pedido/entities/item-pedido.entity';
import { ItensPedidoService } from '../itens-pedido/itens-pedido.service';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { PedidoComItens } from './entities/pedido-com-itens.entity';
import { PedidoComItensDetalhado } from './entities/pedido-com-itens-detalhado.entity';
import { Pedido } from './entities/pedido.entity';
import { StatusPedido } from './enums/status-pedido.enum';

@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ItensPedidoService))
    private readonly itensPedidoService: ItensPedidoService,
  ) {}

  // Etapa 10 / Task 5 (achado A6): ADMIN continua vendo/editando qualquer
  // pedido. VENDEDOR só enxerga pedidos cujo `usuarioId` é o dele mesmo —
  // usa a coluna que já existia no schema (antes nunca lida/escrita por
  // nenhum código) em vez de criar uma relação nova.
  private podeAcessar(
    pedido: { usuarioId: number | null },
    user: UsuarioAutenticado,
  ): boolean {
    return user.perfil === PerfilUsuario.ADMIN || pedido.usuarioId === user.id;
  }

  // Achado da auditoria (integridade financeira): pedido PAGO ou CANCELADO é
  // tratado como imutável — nenhuma mutação (do próprio pedido ou dos itens
  // vinculados, ver ItensPedidoService) pode alterá-lo depois de finalizado.
  // Público porque ItensPedidoService também precisa desta checagem antes de
  // criar/alterar/remover um item. Só afeta mutação — leitura (findOne,
  // findAll, buscarPedidoComItens) continua liberada normalmente.
  garantirMutavel(pedido: { status: StatusPedido }): void {
    if (pedido.status !== StatusPedido.PENDENTE) {
      throw new ConflictException(
        `Pedido com status ${pedido.status} não pode ser alterado.`,
      );
    }
  }

  async findAll(user: UsuarioAutenticado): Promise<Pedido[]> {
    const where =
      user.perfil === PerfilUsuario.ADMIN ? {} : { usuarioId: user.id };
    const pedidos = await this.prisma.pedido.findMany({ where });
    return pedidos.map((pedido) => this.paraPedido(pedido));
  }

  async findOne(id: number, user: UsuarioAutenticado): Promise<Pedido> {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    // Mesma mensagem/status para "não existe" e "existe mas não é seu" —
    // não confirma a existência de um pedido fora do escopo do VENDEDOR.
    if (!pedido || !this.podeAcessar(pedido, user)) {
      throw new NotFoundException(`Pedido com id ${id} não encontrado`);
    }
    return this.paraPedido(pedido);
  }

  async create(
    createPedidoDto: CreatePedidoDto,
    user: UsuarioAutenticado,
  ): Promise<Pedido> {
    const pedido = await this.prisma.pedido.create({
      data: {
        numero: createPedidoDto.numero,
        data: new Date(createPedidoDto.data),
        status: createPedidoDto.status ?? StatusPedido.PENDENTE,
        total: createPedidoDto.total,
        // Sempre o usuário autenticado, nunca aceito do corpo da
        // requisição — CreatePedidoDto não tem campo `usuarioId` (o
        // ValidationPipe global com forbidNonWhitelisted rejeitaria/
        // removeria qualquer tentativa de enviá-lo), então não há como um
        // VENDEDOR assumir um pedido em nome de outro usuário na criação.
        usuarioId: user.id,
      },
    });
    return this.paraPedido(pedido);
  }

  async update(
    id: number,
    updatePedidoDto: UpdatePedidoDto,
    user: UsuarioAutenticado,
  ): Promise<Pedido> {
    const pedidoAtual = await this.findOne(id, user);
    this.garantirMutavel(pedidoAtual);
    const { data, ...rest } = updatePedidoDto;

    const pedido = await this.prisma.pedido.update({
      where: { id },
      data: {
        ...rest,
        ...(data !== undefined && { data: new Date(data) }),
      },
    });
    return this.paraPedido(pedido);
  }

  async remove(id: number, user: UsuarioAutenticado): Promise<void> {
    await this.findOne(id, user);
    await this.prisma.pedido.delete({ where: { id } });
  }

  async buscarItensDoPedido(
    pedidoId: number,
    user: UsuarioAutenticado,
  ): Promise<ItemPedido[]> {
    await this.findOne(pedidoId, user);
    return this.itensPedidoService.findByPedidoId(pedidoId);
  }

  async calcularTotalPedido(
    pedidoId: number,
    user: UsuarioAutenticado,
  ): Promise<number> {
    return this.somarSubtotais(await this.buscarItensDoPedido(pedidoId, user));
  }

  async buscarPedidoComItens(
    pedidoId: number,
    user: UsuarioAutenticado,
  ): Promise<PedidoComItens> {
    const pedido = await this.findOne(pedidoId, user);
    const itens = await this.buscarItensDoPedido(pedidoId, user);
    return { pedido, itens, total: this.somarSubtotais(itens) };
  }

  // Etapa 2 (Minha Conta / Meus Pedidos) — mesma checagem de ownership de
  // buscarPedidoComItens (reaproveitado sem alteração, inclusive o 404
  // genérico para pedido inexistente/de outro usuário), só acrescenta
  // nome/imagem do produto a cada item para a tela do cliente. Busca direta
  // via `this.prisma.produto` (não ProdutosService.findOne) de propósito:
  // um produto excluído depois do pedido não pode derrubar a página inteira
  // com 404 — cai no fallback "Produto não disponível" abaixo.
  async buscarPedidoComItensDetalhado(
    pedidoId: number,
    user: UsuarioAutenticado,
  ): Promise<PedidoComItensDetalhado> {
    const { pedido, itens, total } = await this.buscarPedidoComItens(
      pedidoId,
      user,
    );

    const produtoIds = [...new Set(itens.map((item) => item.produtoId))];
    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: produtoIds } },
      select: { id: true, nome: true, imagemUrl: true },
    });
    const produtoPorId = new Map(produtos.map((produto) => [produto.id, produto]));

    const itensDetalhados = itens.map((item) => {
      const produto = produtoPorId.get(item.produtoId);
      return {
        ...item,
        produtoNome: produto?.nome ?? 'Produto não disponível',
        produtoImagemUrl: produto?.imagemUrl ?? null,
      };
    });

    return { pedido, itens: itensDetalhados, total };
  }

  private somarSubtotais(itens: ItemPedido[]): number {
    return itens.reduce((total, item) => total + item.subtotal, 0);
  }

  private paraPedido(pedido: PedidoPrisma): Pedido {
    return {
      id: pedido.id,
      numero: pedido.numero,
      data: pedido.data,
      status: pedido.status as StatusPedido,
      total: Number(pedido.total),
    };
  }
}
