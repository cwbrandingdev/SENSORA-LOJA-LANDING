import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { DashboardResumo } from './entities/dashboard-resumo.entity';

// Vistoria do Dashboard operacional (Admin) — @Roles(...ADMIN_ONLY_ROLES) é
// deliberado (decisão explícita do pedido: "endpoint protegido para ADMIN"),
// diferente de STAFF_ROLES usado por /pedidos, /produtos e /categorias (que
// o Dashboard também consome). VENDEDOR continua entrando em /workspace-x
// (ProtectedLayout, frontend) mas recebe 403 deste endpoint especificamente
// — o card correspondente cai no estado de erro já existente (MetricCard),
// nunca numa tela quebrada.
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumo')
  obterResumo(): Promise<DashboardResumo> {
    return this.dashboardService.obterResumo();
  }
}
