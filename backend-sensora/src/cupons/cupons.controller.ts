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
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { STAFF_ROLES } from '../common/constants/roles.constants';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SalvarCupomDto } from './dto/salvar-cupom.dto';
import { CupomClienteResumo, CupomResposta } from './entities/cupom.entity';
import { CuponsService } from './cupons.service';

@Controller('cupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
export class CuponsController {
  constructor(private readonly cuponsService: CuponsService) {}

  @Get()
  listar(): Promise<CupomResposta[]> {
    return this.cuponsService.listar();
  }

  @Get('clientes')
  buscarClientes(@Query('busca') busca = ''): Promise<CupomClienteResumo[]> {
    return this.cuponsService.buscarClientes(busca);
  }

  @Get(':id')
  buscar(@Param('id', ParseIntPipe) id: number): Promise<CupomResposta> {
    return this.cuponsService.buscar(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar(@Body() dto: SalvarCupomDto): Promise<CupomResposta> {
    return this.cuponsService.criar(dto);
  }

  @Put(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarCupomDto,
  ): Promise<CupomResposta> {
    return this.cuponsService.atualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remover(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.cuponsService.remover(id);
  }
}
