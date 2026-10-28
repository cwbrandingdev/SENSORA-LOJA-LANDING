import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CarrinhoService } from './carrinho.service';
import { SalvarCarrinhoDto } from './dto/salvar-carrinho.dto';
import { Carrinho } from './entities/carrinho.entity';

// Sem @Roles de propósito: qualquer autenticado gerencia a própria sacola.
// usuarioId nunca vem do body — sempre de @CurrentUser().
@Controller('carrinho')
@UseGuards(JwtAuthGuard)
export class CarrinhoController {
  constructor(private readonly carrinhoService: CarrinhoService) {}

  @Get()
  buscar(@CurrentUser() user: UsuarioAutenticado): Promise<Carrinho> {
    return this.carrinhoService.buscar(user.id);
  }

  @Put()
  salvar(
    @Body() dto: SalvarCarrinhoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Carrinho> {
    return this.carrinhoService.salvar(user.id, dto);
  }
}
