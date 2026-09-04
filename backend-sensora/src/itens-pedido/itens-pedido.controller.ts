import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { STAFF_ROLES } from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateItemPedidoDto } from './dto/update-item-pedido.dto';
import { ItemPedido } from './entities/item-pedido.entity';
import { ItensPedidoService } from './itens-pedido.service';

@Controller('itens-pedido')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
export class ItensPedidoController {
  constructor(private readonly itensPedidoService: ItensPedidoService) {}

  @Get()
  findAll(@CurrentUser() user: UsuarioAutenticado): Promise<ItemPedido[]> {
    return this.itensPedidoService.findAll(user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<ItemPedido> {
    return this.itensPedidoService.findOne(id, user);
  }

  // Etapa 8.1 (complemento — eliminação da venda manual) — POST
  // /itens-pedido foi removido de propósito: não existe mais montagem
  // administrativa de venda item a item. Os itens de um Pedido nascem
  // exclusivamente dentro de CheckoutService.createSession (gravados via
  // Prisma junto com o próprio Pedido, nunca por aqui). O que resta neste
  // controller é só gerenciamento de itens já existentes de um pedido
  // ainda PENDENTE (corrigir quantidade/produto, remover) — nunca criar um
  // item novo do zero.
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateItemPedidoDto: UpdateItemPedidoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<ItemPedido> {
    return this.itensPedidoService.update(id, updateItemPedidoDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<void> {
    return this.itensPedidoService.remove(id, user);
  }
}
