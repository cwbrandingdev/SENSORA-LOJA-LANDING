import { Module } from '@nestjs/common';
import { ImagekitModule } from '../imagekit/imagekit.module';
import { DevolucoesController } from './devolucoes.controller';
import { DevolucoesService } from './devolucoes.service';

@Module({
  imports: [ImagekitModule],
  controllers: [DevolucoesController],
  providers: [DevolucoesService],
})
export class DevolucoesModule {}
