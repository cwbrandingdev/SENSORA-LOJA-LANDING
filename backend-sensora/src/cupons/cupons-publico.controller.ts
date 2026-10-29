import { Controller, Get, Headers } from '@nestjs/common';
import { FaixaCupom } from './entities/cupom.entity';
import { CuponsService } from './cupons.service';

@Controller('public')
export class CuponsPublicoController {
  constructor(private readonly cuponsService: CuponsService) {}

  // Faixa acima do menu. Token ausente ou inválido vira visitante (200),
  // nunca 401: a loja pública não pode mandar ninguém para o login por isso.
  @Get('cupom-faixa')
  async faixa(
    @Headers('authorization') authorization?: string,
  ): Promise<{ faixa: FaixaCupom | null }> {
    const faixa = await this.cuponsService.faixaParaVisitante(authorization);
    return { faixa };
  }
}
