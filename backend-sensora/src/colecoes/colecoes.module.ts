import { Module } from '@nestjs/common';
import { ColecoesController } from './colecoes.controller';
import { ColecoesService } from './colecoes.service';

@Module({
  controllers: [ColecoesController],
  providers: [ColecoesService],
})
export class ColecoesModule {}
