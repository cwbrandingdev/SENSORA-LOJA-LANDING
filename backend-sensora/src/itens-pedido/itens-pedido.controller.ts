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
import { STAFF_ROLES } from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateItemPedidoDto } from './dto/create-item-pedido.dto';
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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createItemPedidoDto: CreateItemPedidoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<ItemPedido> {
    return this.itensPedidoService.create(createItemPedidoDto, user);
  }

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
