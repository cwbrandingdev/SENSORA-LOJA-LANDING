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
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
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
