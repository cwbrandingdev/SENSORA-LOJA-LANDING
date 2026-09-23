import { Module } from '@nestjs/common';
import { MelhorEnvioModule } from '../melhor-envio/melhor-envio.module';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';

@Module({
  // MelhorEnvioModule já exporta MelhorEnvioService (ver melhor-envio.
  // module.ts) — reaproveitado aqui só para estaConectado() (leitura de
  // banco), nunca para cotar frete/trocar token/qualquer chamada externa.
  imports: [MelhorEnvioModule],
  controllers: [AlertasController],
  providers: [AlertasService],
})
export class AlertasModule {}
