import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { MailService } from './mail.service';

// Central de Integrações (Admin) — thin wrapper sobre
// MailService.isConfigured() (já existente, usado internamente por
// enviarEmail() — não duplica lógica, só a expõe). Nunca retorna
// RESEND_API_KEY nem EMAIL_FROM. ADMIN_ONLY_ROLES: mesma proteção da página
// /admin/integracoes (ver AsaasController).
@Controller('admin/mail')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('status')
  status(): { configured: boolean } {
    return { configured: this.mailService.isConfigured() };
  }
}
