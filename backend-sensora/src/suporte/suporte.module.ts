import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { SuporteAdminController } from './suporte-admin.controller';
import { SuporteController } from './suporte.controller';
import { SuporteService } from './suporte.service';

@Module({
  imports: [MailModule],
  controllers: [SuporteController, SuporteAdminController],
  providers: [SuporteService],
})
export class SuporteModule {}
