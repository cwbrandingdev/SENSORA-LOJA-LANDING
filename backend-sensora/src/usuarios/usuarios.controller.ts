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
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ADMIN_ONLY_ROLES,
  TODOS_OS_PERFIS,
} from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { AtualizarMeusDadosDto } from './dto/atualizar-meus-dados.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuarioPublico } from './entities/usuario.entity';
import { UsuariosService } from './usuarios.service';

// ADMIN-only fecha, no mesmo golpe, a vulnerabilidade de autoelevação
// (PUT /usuarios/:id com perfil:"ADMIN"): quem não é ADMIN nunca alcança o
// service, recebe 403 do RolesGuard antes de qualquer lógica de update.
@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  findAll(): Promise<UsuarioPublico[]> {
    return this.usuariosService.findAll();
  }

  // Etapa 3 (Minha Conta / Dados Pessoais) — autoatendimento: qualquer
  // usuário autenticado (CLIENTE incluso) vê/edita SÓ os PRÓPRIOS
  // nome/e-mail. `id` vem exclusivamente de @CurrentUser() (JWT), nunca de
  // parâmetro de URL — por isso não há como um CLIENTE alcançar outra
  // conta através destas duas rotas. Declaradas ANTES de `:id` de propósito
  // (mesmo raciocínio de /pedidos/meus na Etapa 2): "me" é um path literal,
  // precisa ser resolvido antes do parâmetro dinâmico.
  @Get('me')
  @Roles(...TODOS_OS_PERFIS)
  meuPerfil(@CurrentUser() user: UsuarioAutenticado): Promise<UsuarioPublico> {
    return this.usuariosService.findOne(user.id);
  }

  @Put('me')
  @Roles(...TODOS_OS_PERFIS)
  atualizarMeuPerfil(
    @Body() dto: AtualizarMeusDadosDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<UsuarioPublico> {
    return this.usuariosService.atualizarMeusDados(user.id, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<UsuarioPublico> {
    return this.usuariosService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUsuarioDto: CreateUsuarioDto): Promise<UsuarioPublico> {
    return this.usuariosService.create(createUsuarioDto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<UsuarioPublico> {
    return this.usuariosService.update(id, updateUsuarioDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<void> {
    return this.usuariosService.remove(id, user.id);
  }
}
