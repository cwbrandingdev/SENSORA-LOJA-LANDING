import {
  Body,
  Controller,
  Get,
  Header,
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
import type { MelhorEnvioOpcao } from '../melhor-envio/melhor-envio.service';
import { DevolucoesService } from './devolucoes.service';
import {
  AprovarDevolucaoDto,
  RecusarDevolucaoDto,
} from './dto/analisar-devolucao.dto';
import { ConcluirConferenciaDto } from './dto/concluir-conferencia.dto';
import { GerarLogisticaDto } from './dto/gerar-logistica.dto';
import {
  DevolucaoAnalise,
  DevolucaoResumoAdmin,
  DocumentoEnvioDevolucao,
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

  // Etapa 8 — logística reversa. Tudo só ADMIN (herdado da classe): o envio
  // é pago com o saldo da carteira do Melhor Envio.

  // Opções de frete do cliente para a loja (só PAC/SEDEX, os aceitos pela
  // reversa do Melhor Envio).
  @Get(':id/frete-devolucao')
  cotarFrete(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MelhorEnvioOpcao[]> {
    return this.devolucoesService.cotarFreteDevolucao(id);
  }

  // Gera ou retoma a logística reversa (código de devolução) com o serviço
  // escolhido, sem nunca debitar mais do que o custo confirmado.
  @Post(':id/logistica')
  @HttpCode(HttpStatus.OK)
  gerarLogistica(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GerarLogisticaDto,
  ): Promise<DevolucaoAnalise> {
    return this.devolucoesService.gerarLogistica(
      id,
      dto.servicoId,
      dto.custoConfirmado,
    );
  }

  // Recurso secundário: documento do envio. URL gerada agora e nunca
  // guardada (nem em cache).
  @Get(':id/documento')
  @Header('Cache-Control', 'no-store')
  documento(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DocumentoEnvioDevolucao> {
    return this.devolucoesService.documentoParaAdmin(id);
  }

  @Post(':id/rastreio')
  @HttpCode(HttpStatus.OK)
  atualizarRastreio(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DevolucaoAnalise> {
    return this.devolucoesService.atualizarRastreio(id);
  }

  @Post(':id/recebida')
  @HttpCode(HttpStatus.OK)
  confirmarRecebimento(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DevolucaoAnalise> {
    return this.devolucoesService.confirmarRecebimento(id);
  }

  // Etapa 9.1 — conferência e fechamento. Tudo só ADMIN (herdado da classe).

  @Post(':id/conferencia')
  @HttpCode(HttpStatus.OK)
  iniciarConferencia(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DevolucaoAnalise> {
    return this.devolucoesService.iniciarConferencia(id);
  }

  // Registra as quantidades aceitas e pede o reembolso. O valor nunca vem
  // do corpo: é calculado no service.
  @Post(':id/concluir')
  @HttpCode(HttpStatus.OK)
  concluirConferencia(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConcluirConferenciaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<DevolucaoAnalise> {
    return this.devolucoesService.concluirConferencia(
      id,
      user.id,
      dto.itens,
      dto.observacao,
    );
  }

  // Retoma/reconfere o reembolso de uma conferência já registrada.
  @Post(':id/reembolso')
  @HttpCode(HttpStatus.OK)
  reprocessarReembolso(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<DevolucaoAnalise> {
    return this.devolucoesService.reprocessarReembolso(id, user.id);
  }
}
