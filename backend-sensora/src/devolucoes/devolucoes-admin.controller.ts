import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DevolucoesService } from './devolucoes.service';
import {
  AprovarDevolucaoDto,
  RecusarDevolucaoDto,
} from './dto/analisar-devolucao.dto';
import {
  DevolucaoAnalise,
  DevolucaoResumoAdmin,
} from './entities/devolucao.entity';
import { StatusDevolucao } from './enums/status-devolucao.enum';

// Etapa 7 — análise das devoluções no Workspace-X. Só ADMIN: VENDEDOR e
// CLIENTE recebem 403 (VENDEDOR nem vê pedidos de clientes, ver
// PedidosService.podeAcessar). Mesmo prefixo admin/ de admin/asaas,
// admin/mail e admin/melhor-envio.
@Controller('admin/devolucoes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class DevolucoesAdminController {
  constructor(private readonly devolucoesService: DevolucoesService) {}

  // ?status= opcional, validado contra os status existentes (400 se não for).
  @Get()
  listar(
    @Query('status', new ParseEnumPipe(StatusDevolucao, { optional: true }))
    status?: StatusDevolucao,
  ): Promise<DevolucaoResumoAdmin[]> {
    return this.devolucoesService.listarParaAdmin(status);
  }

  @Get(':id')
  buscar(@Param('id', ParseIntPipe) id: number): Promise<DevolucaoAnalise> {
    return this.devolucoesService.buscarParaAnalise(id);
  }

  // Quem analisou vem sempre do token (@CurrentUser), nunca do corpo.
  @Post(':id/aprovar')
  @HttpCode(HttpStatus.OK)
  aprovar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AprovarDevolucaoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<DevolucaoAnalise> {
    return this.devolucoesService.aprovar(id, user.id, dto.observacao);
  }

  @Post(':id/recusar')
  @HttpCode(HttpStatus.OK)
  recusar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecusarDevolucaoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<DevolucaoAnalise> {
    return this.devolucoesService.recusar(id, user.id, dto.observacao);
  }
}
