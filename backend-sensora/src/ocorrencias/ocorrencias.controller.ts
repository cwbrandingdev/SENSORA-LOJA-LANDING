import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ADMIN_ONLY_ROLES } from '../common/constants/roles.constants';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ListarOcorrenciasQueryDto } from './dto/listar-ocorrencias.dto';
import { PaginaOcorrencias } from './entities/ocorrencia.entity';
import { OcorrenciasService } from './ocorrencias.service';

// Ocorrências de negócio — só ADMIN (mesmo padrão de /admin/devolucoes).
@Controller('admin/ocorrencias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ONLY_ROLES)
export class OcorrenciasController {
  constructor(private readonly ocorrenciasService: OcorrenciasService) {}

  @Get()
  listar(
    @Query() query: ListarOcorrenciasQueryDto,
  ): Promise<PaginaOcorrencias> {
    return this.ocorrenciasService.listar(query);
  }
}
