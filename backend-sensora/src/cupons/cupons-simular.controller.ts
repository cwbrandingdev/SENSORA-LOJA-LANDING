import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TODOS_OS_PERFIS } from '../common/constants/roles.constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SimularCupomDto } from './dto/simular-cupom.dto';
import { CupomAplicado } from './entities/cupom.entity';
import { CuponsService } from './cupons.service';

// Prévia do desconto na tela de checkout. O valor cobrado de verdade é
// recalculado de novo em CheckoutService, com o subtotal dos produtos.
@Controller('cupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TODOS_OS_PERFIS)
export class CuponsSimularController {
  constructor(private readonly cuponsService: CuponsService) {}

  @Post('simular')
  simular(
    @Body() dto: SimularCupomDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<CupomAplicado> {
    return this.cuponsService.aplicar(dto.codigo, user.id, dto.subtotal);
  }
}
