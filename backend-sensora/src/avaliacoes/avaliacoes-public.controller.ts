import { Controller, Get, Param } from '@nestjs/common';
import { AvaliacoesService } from './avaliacoes.service';
import { ResumoAvaliacoes } from './entities/avaliacao.entity';

// Público (sem login), ao lado de GET /public/produtos/:slug: só as
// avaliações aprovadas e a média delas.
@Controller('public/produtos')
export class AvaliacoesPublicController {
  constructor(private readonly avaliacoesService: AvaliacoesService) {}

  @Get(':slug/avaliacoes')
  resumo(@Param('slug') slug: string): Promise<ResumoAvaliacoes> {
    return this.avaliacoesService.resumoPublico(slug);
  }
}
