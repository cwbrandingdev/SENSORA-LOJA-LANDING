import { Module } from '@nestjs/common';
import { AsaasController } from './asaas.controller';
import { AsaasService } from './asaas.service';

@Module({
  controllers: [AsaasController],
  providers: [AsaasService],
  exports: [AsaasService],
})
export class AsaasModule {}
