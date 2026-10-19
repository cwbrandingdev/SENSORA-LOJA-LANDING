import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { AvaliacoesService } from './avaliacoes.service';
import { SalvarAvaliacaoDto } from './dto/salvar-avaliacao.dto';
import {
  AvaliacaoDoCliente,
  AvaliacoesDoPedido,
} from './entities/avaliacao.entity';

// Só CLIENTE: quem avalia é quem comprou. O pedido precisa ser do usuário
// do token (verificado no service), nunca informado pelo corpo.
@Controller('avaliacoes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.CLIENTE)
export class AvaliacoesController {
  constructor(private readonly avaliacoesService: AvaliacoesService) {}

  @Get('pedido/:pedidoId')
  listarDoPedido(
    @Param('pedidoId', ParseIntPipe) pedidoId: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<AvaliacoesDoPedido> {
    return this.avaliacoesService.listarDoPedido(pedidoId, user);
  }

  @Put('pedido/:pedidoId/produto/:produtoId')
  salvar(
    @Param('pedidoId', ParseIntPipe) pedidoId: number,
    @Param('produtoId', ParseIntPipe) produtoId: number,
    @Body() dto: SalvarAvaliacaoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<AvaliacaoDoCliente> {
    return this.avaliacoesService.salvar(pedidoId, produtoId, dto, user);
  }
}
