import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { AsaasService, AsaasVerificacaoOperacional } from './asaas.service';

// Central de Integrações (Admin) — thin wrapper sobre AsaasService.
// isConfigured()/baseUrlConfigurado/gatewayAtivo: nunca expõe
// ASAAS_API_KEY nem toca em criarCheckout/consultarCheckout/
// estornarPagamento (checkout/pagamento/reembolso ficam inteiramente
// intocados). ADMIN_ONLY_ROLES (não STAFF_ROLES): a página
// /admin/integracoes é ADMIN-only, e esta é a contraparte real de backend
// dessa restrição — o frontend sozinho nunca é a autoridade final.
@Controller('admin/asaas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class AsaasController {
  constructor(private readonly asaasService: AsaasService) {}

  @Get('status')
  status(): { configured: boolean; baseUrl?: string; gatewayAtivo: 'asaas' | 'stripe' } {
    return {
      configured: this.asaasService.isConfigured(),
      baseUrl: this.asaasService.baseUrlConfigurado,
      gatewayAtivo: this.asaasService.gatewayAtivo,
    };
  }

  // Verificação real sob demanda (botão "Verificar agora" na Central de
  // Integrações) — GET, nunca POST: é uma leitura sem efeito colateral
  // (ver AsaasService.verificarOperacional), disparada só quando o ADMIN
  // clica, nunca automaticamente a cada carregamento da página.
  @Get('verificar')
  verificar(): Promise<AsaasVerificacaoOperacional> {
    return this.asaasService.verificarOperacional();
  }
}
