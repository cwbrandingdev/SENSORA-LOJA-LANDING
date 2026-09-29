import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import {
  DevolucoesService,
  TAMANHO_MAXIMO_EVIDENCIA,
} from './devolucoes.service';
import type { ArquivoEnviado } from './devolucoes.service';
import { CreateDevolucaoDto } from './dto/create-devolucao.dto';
import { Devolucao, EvidenciaDevolucao } from './entities/devolucao.entity';

// Rotas do cliente sob /pedidos/meus/:id/..., mesmo formato de
// POST /pedidos/meus/:id/cancelar (PedidosController). Só CLIENTE: a
// devolução é sempre pedida por quem comprou.
@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.CLIENTE)
export class DevolucoesController {
  constructor(private readonly devolucoesService: DevolucoesService) {}

  // O usuário vem sempre do token (@CurrentUser), nunca do corpo.
  @Post('meus/:id/devolucoes')
  @HttpCode(HttpStatus.CREATED)
  criar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDevolucaoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Devolucao> {
    return this.devolucoesService.criar(id, dto, user);
  }

  @Get('meus/:id/devolucoes/:devolucaoId')
  buscar(
    @Param('id', ParseIntPipe) id: number,
    @Param('devolucaoId', ParseIntPipe) devolucaoId: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Devolucao> {
    return this.devolucoesService.buscar(id, devolucaoId, user);
  }

  // Uma foto por requisição, no campo "foto" (multipart). O limite de 5 MB
  // é aplicado aqui mesmo, no servidor (acima disso: 413), antes de o
  // arquivo inteiro ser lido; o formato é conferido no service.
  @Post('meus/:id/devolucoes/:devolucaoId/evidencias')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('foto', {
      limits: { fileSize: TAMANHO_MAXIMO_EVIDENCIA, files: 1 },
    }),
  )
  adicionarEvidencia(
    @Param('id', ParseIntPipe) id: number,
    @Param('devolucaoId', ParseIntPipe) devolucaoId: number,
    @UploadedFile() arquivo: ArquivoEnviado | undefined,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<EvidenciaDevolucao> {
    return this.devolucoesService.adicionarEvidencia(
      id,
      devolucaoId,
      arquivo,
      user,
    );
  }

  @Delete('meus/:id/devolucoes/:devolucaoId/evidencias/:evidenciaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removerEvidencia(
    @Param('id', ParseIntPipe) id: number,
    @Param('devolucaoId', ParseIntPipe) devolucaoId: number,
    @Param('evidenciaId', ParseIntPipe) evidenciaId: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<void> {
    return this.devolucoesService.removerEvidencia(
      id,
      devolucaoId,
      evidenciaId,
      user,
    );
  }
}
