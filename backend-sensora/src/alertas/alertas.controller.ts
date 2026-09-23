import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AlertasService } from './alertas.service';
import { Alerta } from './entities/alerta.entity';

// Vistoria de Alertas Operacionais (Admin) — ADMIN-only, mesmo padrão de
// GET /dashboard/resumo (DashboardController): endpoint agregado que só
// ADMIN acessa, nenhuma mudança nas permissões já existentes de
// /pedidos, /produtos ou /admin/melhor-envio/*.
@Controller('alertas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Get()
  obterAlertas(): Promise<Alerta[]> {
    return this.alertasService.obterAlertas();
  }
}
