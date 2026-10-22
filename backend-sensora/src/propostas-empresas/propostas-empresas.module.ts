import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import {
  PropostasEmpresasAdminController,
  PropostasEmpresasPublicController,
} from './propostas-empresas.controller';
import { PropostasEmpresasService } from './propostas-empresas.service';

@Module({
  imports: [MailModule],
  controllers: [
    PropostasEmpresasPublicController,
    PropostasEmpresasAdminController,
  ],
  providers: [PropostasEmpresasService],
})
export class PropostasEmpresasModule {}
