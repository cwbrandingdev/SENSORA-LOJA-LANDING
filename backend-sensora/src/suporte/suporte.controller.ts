import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { CreateSolicitacaoSuporteDto } from './dto/create-solicitacao-suporte.dto';
import {
  SolicitacaoSuporteCriada,
  SolicitacaoSuporteDoCliente,
} from './entities/solicitacao-suporte.entity';
import { SuporteService } from './suporte.service';

// Limite próprio da abertura de solicitações (cada uma dispara e-mails aos
// admins): sobrescreve, só nesta rota, o throttler 'default' global — mesmo
// mecanismo do @Throttle do AuthController, não um segundo limitador.
export const SUPORTE_RATE_LIMIT_MAX = 5;
export const SUPORTE_RATE_LIMIT_TTL_MS = 60 * 60 * 1000;

// Só CLIENTE (mesmo padrão de DevolucoesController): o suporte é pedido
// por quem compra na loja.
@Controller('suporte')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PerfilUsuario.CLIENTE)
export class SuporteController {
  constructor(private readonly suporteService: SuporteService) {}

  // O usuário vem sempre do token (@CurrentUser), nunca do corpo.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({
    default: { limit: SUPORTE_RATE_LIMIT_MAX, ttl: SUPORTE_RATE_LIMIT_TTL_MS },
  })
  criar(
    @Body() dto: CreateSolicitacaoSuporteDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<SolicitacaoSuporteCriada> {
    return this.suporteService.criar(dto, user);
  }

  // Os chamados do próprio cliente (usuário do token) e a situação de cada um.
  @Get()
  listar(
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<SolicitacaoSuporteDoCliente[]> {
    return this.suporteService.listarDoCliente(user.id);
  }
}
