import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AvaliacoesService } from './avaliacoes.service';
import { AtualizarStatusAvaliacaoDto } from './dto/atualizar-status-avaliacao.dto';
import { ListarAvaliacoesQueryDto } from './dto/listar-avaliacoes.dto';
import { AvaliacaoAdmin } from './entities/avaliacao.entity';

// Moderação das avaliações — ADMIN-only, mesmo padrão de admin/suporte.
@Controller('admin/avaliacoes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class AvaliacoesAdminController {
  constructor(private readonly avaliacoesService: AvaliacoesService) {}

  @Get()
  listar(@Query() query: ListarAvaliacoesQueryDto): Promise<AvaliacaoAdmin[]> {
    return this.avaliacoesService.listarParaAdmin(query.status);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  atualizarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarStatusAvaliacaoDto,
  ): Promise<void> {
    return this.avaliacoesService.atualizarStatus(id, dto.status);
  }
}
