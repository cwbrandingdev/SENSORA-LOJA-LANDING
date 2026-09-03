import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { AsaasService } from './asaas.service';

// Central de Integrações (Admin) — thin wrapper sobre AsaasService.
// isConfigured()/baseUrlConfigurado: nunca expõe ASAAS_API_KEY nem toca em
// criarCheckout/consultarCheckout/estornarPagamento (checkout/pagamento/
// reembolso ficam inteiramente intocados). ADMIN_ONLY_ROLES (não
// STAFF_ROLES): a página /admin/integracoes é ADMIN-only, e esta é a
// contraparte real de backend dessa restrição — o frontend sozinho nunca é
// a autoridade final.
@Controller('admin/asaas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class AsaasController {
  constructor(private readonly asaasService: AsaasService) {}

  @Get('status')
  status(): { configured: boolean; baseUrl?: string } {
    return {
      configured: this.asaasService.isConfigured(),
      baseUrl: this.asaasService.baseUrlConfigurado,
    };
  }
}
