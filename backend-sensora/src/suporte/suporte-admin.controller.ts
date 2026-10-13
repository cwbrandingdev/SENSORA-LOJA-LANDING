import {
  Body,
  Controller,
  Get,
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
import { AtualizarStatusSuporteDto } from './dto/atualizar-status-suporte.dto';
import { ListarSolicitacoesSuporteQueryDto } from './dto/listar-solicitacoes-suporte.dto';
import {
  PaginaSolicitacoesSuporte,
  SolicitacaoSuporteDetalhe,
} from './entities/solicitacao-suporte.entity';
import { SuporteService } from './suporte.service';

// Solicitações de suporte no Workspace-X. Só ADMIN: VENDEDOR e CLIENTE
// recebem 403 (mesmo padrão de admin/devolucoes e admin/ocorrencias). A
// resposta ao cliente é por e-mail, fora daqui: o painel só acompanha.
@Controller('admin/suporte')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class SuporteAdminController {
  constructor(private readonly suporteService: SuporteService) {}

  @Get()
  listar(
    @Query() query: ListarSolicitacoesSuporteQueryDto,
  ): Promise<PaginaSolicitacoesSuporte> {
    return this.suporteService.listarParaAdmin(query);
  }

  @Get(':id')
  buscar(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SolicitacaoSuporteDetalhe> {
    return this.suporteService.buscarParaAdmin(id);
  }

  @Patch(':id/status')
  atualizarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarStatusSuporteDto,
  ): Promise<SolicitacaoSuporteDetalhe> {
    return this.suporteService.atualizarStatus(id, dto);
  }
}
