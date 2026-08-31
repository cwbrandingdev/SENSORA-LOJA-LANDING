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
import { CreateEnderecoDto } from './dto/create-endereco.dto';
import { UpdateEnderecoDto } from './dto/update-endereco.dto';
import { Endereco } from './entities/endereco.entity';
import { EnderecosService } from './enderecos.service';

// Sem @Roles/RolesGuard de propósito: não é um recurso administrativo,
// qualquer usuário autenticado (independente de perfil) gerencia os
// próprios endereços. usuarioId nunca vem do body — sempre de
// @CurrentUser() (populado pelo JwtStrategy a partir do token) — ver
// comentário em prisma/schema.prisma#Endereco.
@Controller('enderecos')
@UseGuards(JwtAuthGuard)
export class EnderecosController {
  constructor(private readonly enderecosService: EnderecosService) {}

  @Get()
  findMine(@CurrentUser() user: UsuarioAutenticado): Promise<Endereco[]> {
    return this.enderecosService.findByUsuario(user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Endereco> {
    return this.enderecosService.findOneForUsuario(id, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateEnderecoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Endereco> {
    return this.enderecosService.create(user.id, dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEnderecoDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<Endereco> {
    return this.enderecosService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<void> {
    return this.enderecosService.remove(id, user.id);
  }
}
