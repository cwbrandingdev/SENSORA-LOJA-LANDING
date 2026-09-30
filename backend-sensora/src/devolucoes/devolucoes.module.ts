import { Module } from '@nestjs/common';
import { ImagekitModule } from '../imagekit/imagekit.module';
import { MailModule } from '../mail/mail.module';
import { DevolucoesAdminController } from './devolucoes-admin.controller';
import { DevolucoesController } from './devolucoes.controller';
import { DevolucoesService } from './devolucoes.service';

@Module({
  imports: [ImagekitModule, MailModule],
  controllers: [DevolucoesController, DevolucoesAdminController],
  providers: [DevolucoesService],
})
export class DevolucoesModule {}
