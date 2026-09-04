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

  // Listagem do Admin — mais recente primeiro (ordenarPorDataDesc), usando
  // o campo `data` (data de criação do pedido). GET /pedidos/meus abaixo
  // continua chamando findAll sem essa opção, então a ordem de "Meus
  // Pedidos" não muda.
  @Get()
  findAll(@CurrentUser() user: UsuarioAutenticado): Promise<Pedido[]> {
    return this.pedidosService.findAll(user, { ordenarPorDataDesc: true });
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

  // Etapa 5B.4 (Solicitação de Reembolso) — mesmo padrão de
  // `cancelar-meu-pedido` acima: operação específica (nunca um PUT
  // genérico), sem `@Body()` nenhum — o cliente só pode disparar exatamente
  // esta transição (PAGO -> REEMBOLSO_SOLICITADO), nunca informar
  // paymentId/value/usuarioId (nada disso é lido do corpo da requisição,
  // que é ignorado por completo aqui). Ownership real, idempotência e o
  // claim atômico são sempre resolvidos dentro de
  // PedidosService.solicitarReembolso(), nunca confiados ao guard sozinho.
  @Post('meus/:id/cancelar-pago')
  @Roles(...TODOS_OS_PERFIS)
  @HttpCode(HttpStatus.OK)
  solicitarReembolsoMeuPedido(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Pedido> {
    return this.pedidosService.solicitarReembolso(id, user);
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

  // Etapa 6.6 (Status de Envio) — ação administrativa específica (nunca um
  // PUT genérico, mesmo padrão de cancelar-meu-pedido/cancelar-pago acima),
  // sem @Body(): a única transição possível é NAO_ENVIADO -> ENVIADO,
  // resolvida inteiramente dentro de PedidosService.marcarComoEnviado
  // (regra "só a partir de PAGO", idempotência, claim atômico contra
  // corrida). Herda @Roles(...STAFF_ROLES) da classe — nenhum override
  // necessário, CLIENTE nunca alcança esta rota.
  @Post(':id/marcar-enviado')
  @HttpCode(HttpStatus.OK)
  marcarComoEnviado(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Pedido> {
    return this.pedidosService.marcarComoEnviado(id, user);
  }

  // Etapa 8.1 (complemento — eliminação da venda manual) — POST /pedidos foi
  // removido de propósito: não existe mais criação administrativa de
  // pedido, mesmo como PENDENTE. Toda venda nasce exclusivamente do fluxo
  // Carrinho -> Checkout -> CheckoutService.createSession (que cria o
  // Pedido diretamente via Prisma, nunca por aqui). O que resta neste
  // controller é só gerenciamento de pedidos já existentes (editar
  // numero/data/total, cancelar, reembolsar, marcar como enviado, listar,
  // consultar) — nunca criação de venda.
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
