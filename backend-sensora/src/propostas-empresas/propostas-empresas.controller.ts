import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AtualizarStatusPropostaDto } from './dto/atualizar-status-proposta.dto';
import { CriarPropostaEmpresaDto } from './dto/criar-proposta-empresa.dto';
import { PropostasEmpresasService } from './propostas-empresas.service';

// Formulário público da página "Para empresas": sem login, com limite
// próprio de envios por IP (5 por hora) para conter spam.
@Controller('public/propostas-empresas')
export class PropostasEmpresasPublicController {
  constructor(private readonly service: PropostasEmpresasService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  criar(@Body() dto: CriarPropostaEmpresaDto) {
    return this.service.criar(dto);
  }
}

// Acompanhamento no Workspace-X — só ADMIN (mesmo padrão de admin/suporte).
@Controller('admin/propostas-empresas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class PropostasEmpresasAdminController {
  constructor(private readonly service: PropostasEmpresasService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Patch(':id/status')
  atualizarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarStatusPropostaDto,
  ) {
    return this.service.atualizarStatus(id, dto.status);
  }
}
