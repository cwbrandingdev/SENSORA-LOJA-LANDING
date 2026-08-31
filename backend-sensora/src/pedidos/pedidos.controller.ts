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
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { PedidoComItens } from './entities/pedido-com-itens.entity';
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
