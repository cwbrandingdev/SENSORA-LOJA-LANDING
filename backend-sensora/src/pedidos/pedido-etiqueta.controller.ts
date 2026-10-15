import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ADMIN_ONLY_ROLES,
  STAFF_ROLES,
} from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { GerarEtiquetaDto } from './dto/gerar-etiqueta.dto';
import { Pedido } from './entities/pedido.entity';
import { PedidoEtiquetaService } from './pedido-etiqueta.service';

@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
export class PedidoEtiquetaController {
  constructor(private readonly etiquetaService: PedidoEtiquetaService) {}

  // Só ADMIN: debita o saldo da carteira do Melhor Envio.
  @Post(':id/etiqueta')
  @Roles(...ADMIN_ONLY_ROLES)
  @HttpCode(HttpStatus.OK)
  gerar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GerarEtiquetaDto = {},
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Pedido> {
    return this.etiquetaService.gerar(id, user, dto?.chaveNotaFiscal);
  }

  @Get(':id/etiqueta')
  imprimir(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<{ url: string }> {
    return this.etiquetaService.urlEtiqueta(id, user);
  }
}
