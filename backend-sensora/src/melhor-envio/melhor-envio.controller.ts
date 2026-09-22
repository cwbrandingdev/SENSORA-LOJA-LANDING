import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ONLY_ROLES, STAFF_ROLES } from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { MelhorEnvioService } from './melhor-envio.service';

// Etapa 6.5 (Frete), Parte 2 — conexão OAuth2 da loja com o Melhor Envio.
// Só ADMIN/VENDEDOR (mesmo padrão de acesso administrativo já usado no
// resto do projeto, ver STAFF_ROLES) conseguem iniciar a conexão; o
// callback é a exceção deliberada abaixo.
@Controller('admin/melhor-envio')
export class MelhorEnvioController {
  constructor(private readonly melhorEnvioService: MelhorEnvioService) {}

  // Central de Integrações (Admin) — status agora expõe `configured`
  // (credenciais presentes) e `conectado` (token salvo) como conceitos
  // separados, além de `ambiente`/`expiresAt` (nenhum dos dois é secreto —
  // ver MelhorEnvioService.obterStatusConexao). ADMIN_ONLY_ROLES (não mais
  // STAFF_ROLES): a página /admin/integracoes é ADMIN-only — este endpoint
  // agora segue o mesmo padrão de AsaasController/MailController/
  // ImagekitController.status(). `conectar`/`callback` abaixo continuam
  // STAFF_ROLES, intocados — só a leitura de status muda de escopo.
  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ONLY_ROLES)
  async status(): Promise<{
    configured: boolean;
    conectado: boolean;
    ambiente: 'sandbox' | 'production';
    expiresAt: string | null;
  }> {
    return this.melhorEnvioService.obterStatusConexao();
  }

  // Verificação real sob demanda (botão "Verificar agora" na Central de
  // Integrações) — GET, nunca POST: é uma leitura sem efeito colateral
  // (ver MelhorEnvioService.verificarOperacional), disparada só quando o
  // ADMIN clica, nunca automaticamente.
  @Get('verificar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ONLY_ROLES)
  verificar(): Promise<{ operational: boolean; mensagem?: string }> {
    return this.melhorEnvioService.verificarOperacional();
  }

  // Devolve a URL de autorização do Melhor Envio para o admin abrir
  // manualmente no navegador (fluxo OAuth2 "authorization code" — precisa
  // do login/consentimento do dono da conta Melhor Envio, não pode ser
  // automatizado pelo backend).
  @Get('conectar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  conectar(): { url: string } {
    return { url: this.melhorEnvioService.gerarUrlAutorizacao() };
  }

  // Único endpoint deste controller sem JwtAuthGuard: quem chama é o
  // navegador do admin sendo redirecionado PELO Melhor Envio depois do
  // consentimento (requisição de navegador de terceiros, sem o JWT da
  // Sensora). A segurança aqui não vem do guard — vem do `state` de uso
  // único gerado em conectar() e validado dentro de trocarCodigoPorToken
  // (mesmo raciocínio de proteção CSRF de qualquer fluxo OAuth2
  // authorization code).
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
  ): Promise<{ message: string }> {
    await this.melhorEnvioService.trocarCodigoPorToken(code, state);
    return { message: 'Conta do Melhor Envio conectada com sucesso.' };
  }
}
