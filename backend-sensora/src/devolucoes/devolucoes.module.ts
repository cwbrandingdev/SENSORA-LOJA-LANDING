import { Module } from '@nestjs/common';
import { AsaasModule } from '../asaas/asaas.module';
import { ImagekitModule } from '../imagekit/imagekit.module';
import { MailModule } from '../mail/mail.module';
import { MelhorEnvioModule } from '../melhor-envio/melhor-envio.module';
import { OcorrenciasModule } from '../ocorrencias/ocorrencias.module';
import { DevolucoesAdminController } from './devolucoes-admin.controller';
import { DevolucoesController } from './devolucoes.controller';
import { DevolucoesService } from './devolucoes.service';

@Module({
  imports: [
    ImagekitModule,
    MailModule,
    MelhorEnvioModule,
    AsaasModule,
    OcorrenciasModule,
  ],
  controllers: [DevolucoesController, DevolucoesAdminController],
  providers: [DevolucoesService],
  // Etapa 9.1 — CheckoutService conclui devoluções a partir dos webhooks de
  // reembolso do Asaas.
  exports: [DevolucoesService],
})
export class DevolucoesModule {}
