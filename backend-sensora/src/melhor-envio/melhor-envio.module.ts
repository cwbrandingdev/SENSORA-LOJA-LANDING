import { Module } from '@nestjs/common';
import { MelhorEnvioController } from './melhor-envio.controller';
import { MelhorEnvioService } from './melhor-envio.service';

@Module({
  controllers: [MelhorEnvioController],
  providers: [MelhorEnvioService],
  exports: [MelhorEnvioService],
})
export class MelhorEnvioModule {}
