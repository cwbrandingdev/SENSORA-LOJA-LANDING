import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { STAFF_ROLES } from '../common/constants/roles.constants';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CheckoutService } from './checkout.service';
import { CheckoutPendenteAdmin } from './entities/checkout-pendente-admin.entity';

// Lista operacional de sacola parada + checkout não pago — mesmo acesso
// de GET /pedidos (ADMIN + VENDEDOR). Não é mala direta: só leitura para
// a equipe falar com o cliente (WhatsApp/e-mail).
@Controller('admin/checkout')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
export class CheckoutAdminController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get('pendentes')
  listarPendentes(): Promise<CheckoutPendenteAdmin[]> {
    return this.checkoutService.listarPendentesAdmin();
  }
}
