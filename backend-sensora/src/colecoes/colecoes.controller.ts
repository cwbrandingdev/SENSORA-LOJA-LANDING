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
import { Roles } from '../common/decorators/roles.decorator';
import { STAFF_ROLES } from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { ColecoesService } from './colecoes.service';
import { CreateColecaoDto } from './dto/create-colecao.dto';
import { UpdateColecaoDto } from './dto/update-colecao.dto';
import { Colecao } from './entities/colecao.entity';

// Admin das coleções de datas festivas. A loja lê as ativas por
// /public/colecoes (PublicController).
@Controller('colecoes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
export class ColecoesController {
  constructor(private readonly colecoesService: ColecoesService) {}

  @Get()
  findAll(): Promise<Colecao[]> {
    return this.colecoesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Colecao> {
    return this.colecoesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateColecaoDto): Promise<Colecao> {
    return this.colecoesService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateColecaoDto,
  ): Promise<Colecao> {
    return this.colecoesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.colecoesService.remove(id);
  }
}
