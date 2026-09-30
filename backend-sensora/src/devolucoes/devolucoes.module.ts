import { Module } from '@nestjs/common';
import { ImagekitModule } from '../imagekit/imagekit.module';
import { MailModule } from '../mail/mail.module';
import { MelhorEnvioModule } from '../melhor-envio/melhor-envio.module';
import { DevolucoesAdminController } from './devolucoes-admin.controller';
import { DevolucoesController } from './devolucoes.controller';
import { DevolucoesService } from './devolucoes.service';

@Module({
  imports: [ImagekitModule, MailModule, MelhorEnvioModule],
  controllers: [DevolucoesController, DevolucoesAdminController],
  providers: [DevolucoesService],
})
export class DevolucoesModule {}
