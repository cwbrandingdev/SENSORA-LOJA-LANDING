import { Module } from '@nestjs/common';
import { OcorrenciasController } from './ocorrencias.controller';
import { OcorrenciasService } from './ocorrencias.service';

@Module({
  controllers: [OcorrenciasController],
  providers: [OcorrenciasService],
  // Os fluxos de checkout/pagamento/reembolso/devolução registram por aqui
  // (próxima etapa).
  exports: [OcorrenciasService],
})
export class OcorrenciasModule {}
