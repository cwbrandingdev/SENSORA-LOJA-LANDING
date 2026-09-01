import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { STAFF_ROLES, TODOS_OS_PERFIS } from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { PedidoComItens } from './entities/pedido-com-itens.entity';
import { PedidoComItensDetalhado } from './entities/pedido-com-itens-detalhado.entity';
import { Pedido } from './entities/pedido.entity';
import { PedidosService } from './pedidos.service';

@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Get()
  findAll(@CurrentUser() user: UsuarioAutenticado): Promise<Pedido[]> {
    return this.pedidosService.findAll(user);
  }

  // Etapa 2 (Minha Conta / Meus Pedidos) — autoatendimento: qualquer usuário
  // autenticado (CLIENTE incluso) só vê os PRÓPRIOS pedidos.
  // PedidosService.findAll já filtra por usuarioId para qualquer perfil que
  // não seja ADMIN (mesma lógica já usada para VENDEDOR) — nenhuma mudança
  // no service foi necessária, só abrir a rota. Declarada ANTES de
  // `:id`/`:id/itens` de propósito: rota literal precisa vir antes do
  // parâmetro dinâmico, senão "/pedidos/meus" seria interpretado como
  // "/pedidos/:id" com id="meus" (ParseIntPipe rejeitaria, e o guard de
  // STAFF_ROLES do handler abaixo bloquearia CLIENTE antes de chegar aqui).
  @Get('meus')
  @Roles(...TODOS_OS_PERFIS)
  findMeusPedidos(@CurrentUser() user: UsuarioAutenticado): Promise<Pedido[]> {
    return this.pedidosService.findAll(user);
  }

  // Mesma lógica de ownership de findOne/buscarPedidoComItens (reaproveitados
  // sem alteração) — só enriquece os itens com nome/imagem do produto, dado
  // que a tela de "Meus Pedidos" precisa exibir o produto, não só o
  // produtoId. Pedido inexistente ou de outro usuário: mesmo 404 genérico de
  // sempre (ver PedidosService.findOne) — nunca revela qual dos dois casos.
  @Get('meus/:id')
  @Roles(...TODOS_OS_PERFIS)
  findMeuPedidoDetalhado(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<PedidoComItensDetalhado> {
    return this.pedidosService.buscarPedidoComItensDetalhado(id, user);
  }

  // Etapa 5A (Cancelamento de Pedido) — operação específica, não um PUT
  // genérico: o cliente nunca pode enviar um status arbitrário, só disparar
  // esta transição exata (PENDENTE -> CANCELADO). Mesma posição/raciocínio
  // de `meus`/`meus/:id`: rota "meus/:id/cancelar" não colide com `:id`
  // abaixo (profundidades de path diferentes), mas fica agrupada aqui por
  // clareza. @Roles(...TODOS_OS_PERFIS): mesmo padrão de autoatendimento —
  // ownership real é sempre resolvido dentro de PedidosService.cancelar()
  // (findOne + condição no updateMany), nunca confiado ao guard sozinho.
  @Post('meus/:id/cancelar')
  @Roles(...TODOS_OS_PERFIS)
  @HttpCode(HttpStatus.OK)
  cancelarMeuPedido(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Pedido> {
    return this.pedidosService.cancelar(id, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Pedido> {
    return this.pedidosService.findOne(id, user);
  }

  @Get(':id/itens')
  findItens(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<PedidoComItens> {
    return this.pedidosService.buscarPedidoComItens(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createPedidoDto: CreatePedidoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Pedido> {
    return this.pedidosService.create(createPedidoDto, user);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePedidoDto: UpdatePedidoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Pedido> {
    return this.pedidosService.update(id, updatePedidoDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<void> {
    return this.pedidosService.remove(id, user);
  }
}
