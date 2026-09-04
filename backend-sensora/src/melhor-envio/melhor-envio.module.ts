import { Module } from '@nestjs/common';
import { MelhorEnvioController } from './melhor-envio.controller';
import { MelhorEnvioTokenCryptoService } from './melhor-envio-token-crypto.service';
import { MelhorEnvioService } from './melhor-envio.service';

@Module({
  controllers: [MelhorEnvioController],
  // Etapa 8.4 — MelhorEnvioTokenCryptoService não é exportado de propósito:
  // só MelhorEnvioService (dentro deste módulo) conhece/chama
  // encrypt()/decrypt() — nenhum outro módulo do projeto deve manipular
  // tokens do Melhor Envio diretamente.
  providers: [MelhorEnvioService, MelhorEnvioTokenCryptoService],
  exports: [MelhorEnvioService],
})
export class MelhorEnvioModule {}
