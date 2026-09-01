import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import {
  CheckoutSessionResponse,
  CheckoutSessionStatus,
} from './entities/checkout-session.entity';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('session')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  createSession(
    @Body() dto: CreateCheckoutSessionDto,
    @Req() req: { user: UsuarioAutenticado },
  ): Promise<CheckoutSessionResponse> {
    return this.checkoutService.createSession(dto, req.user.id);
  }

  // Etapa 2 (Minha Conta / limpeza do carrinho) — passou a ser chamado pelo
  // frontend (/checkout/sucesso) para confirmar o status real antes de
  // esvaziar o carrinho. Achado da auditoria: faltava checagem de ownership
  // aqui — qualquer autenticado podia consultar QUALQUER sessionId e receber
  // pedidoId/pedidoNumero de outro cliente. Corrigido em
  // CheckoutService.getSessionStatus (mesmo padrão de PedidosService.podeAcessar).
  @Get('session/:sessionId')
  @UseGuards(JwtAuthGuard)
  getSessionStatus(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<CheckoutSessionStatus> {
    return this.checkoutService.getSessionStatus(sessionId, user);
  }

  // Task 15/21 — endpoint público de propósito (o gateway de pagamento é
  // quem chama, nunca o frontend/um usuário autenticado): a única
  // "autenticação" válida aqui é verificada dentro de
  // CheckoutService.handleWebhook (assinatura HMAC via
  // STRIPE_WEBHOOK_SECRET no modo Stripe, token via ASAAS_WEBHOOK_TOKEN no
  // modo Asaas), nunca um JwtAuthGuard. Ambos os headers são só repassados
  // aqui — o serviço decide qual usar de acordo com CHECKOUT_GATEWAY.
  // Nenhum dado do corpo é confiado antes dessa verificação.
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Headers('stripe-signature') stripeSignature: string,
    @Headers('asaas-access-token') asaasAccessToken: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new Error('Raw body não disponível para webhook de checkout');
    }
    return this.checkoutService.handleWebhook(
      { stripeSignature, asaasAccessToken },
      rawBody,
    );
  }
}
