import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { AvaliacoesAdminController } from './avaliacoes-admin.controller';
import { AvaliacoesPublicController } from './avaliacoes-public.controller';
import { AvaliacoesController } from './avaliacoes.controller';
import { AvaliacoesService } from './avaliacoes.service';

@Module({
  imports: [MailModule],
  controllers: [
    AvaliacoesController,
    AvaliacoesPublicController,
    AvaliacoesAdminController,
  ],
  providers: [AvaliacoesService],
})
export class AvaliacoesModule {}
