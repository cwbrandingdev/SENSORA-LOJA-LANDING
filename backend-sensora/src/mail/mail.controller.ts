import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { MailService } from './mail.service';

// Central de Integrações (Admin) — thin wrapper sobre
// MailService.isConfigured()/remetenteConfigurado (já existentes, usados
// internamente por enviarEmail() — não duplica lógica, só os expõe). `from`
// é o EMAIL_FROM configurado — não é secreto (endereço que já aparece para
// qualquer destinatário) — mas RESEND_API_KEY nunca é retornada. Resend já
// foi validado em produção com envio real: esta etapa não adiciona
// verificação ao vivo aqui (nenhum e-mail é disparado), só mais contexto
// sobre a configuração existente. ADMIN_ONLY_ROLES: mesma proteção da
// página /admin/integracoes (ver AsaasController).
@Controller('admin/mail')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('status')
  status(): { configured: boolean; from?: string } {
    return {
      configured: this.mailService.isConfigured(),
      from: this.mailService.remetenteConfigurado,
    };
  }
}
