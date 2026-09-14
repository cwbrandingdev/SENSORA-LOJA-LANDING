import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuarioPublico } from '../usuarios/entities/usuario.entity';
import { AuthService } from './auth.service';
import { AlterarMinhaSenhaDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthToken } from './entities/auth-token.entity';
import { ChangePasswordResponse } from './entities/change-password-response.entity';
import { ForgotPasswordResponse } from './entities/forgot-password-response.entity';
import { LogoutResponse } from './entities/logout-response.entity';
import { ResendVerificationResponse } from './entities/resend-verification-response.entity';
import { ResetPasswordResponse } from './entities/reset-password-response.entity';
import { VerifyEmailResponse } from './entities/verify-email-response.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// Etapa 10 / Task 4 (achado A2): limite de tentativas mais rigoroso só para
// as rotas de auth (login, register, forgot/reset-password, verify/resend,
// refresh, logout, change-password) — aplicar no nível da classe cobre
// todas sem precisar decorar uma por uma (e cobre automaticamente qualquer
// rota de auth futura, sem risco de esquecer alguma).
//
// Etapa 10 / Task CFG-01 (achado da auditoria — sem rate limit global):
// o guard que executa esse limite agora é global (CloudflareAwareThrottlerGuard
// registrado como APP_GUARD em app.module.ts, cobrindo todo o app com um
// throttler 'default' leve). Este @Throttle() só SOBRESCREVE, para as rotas
// deste controller, o limite/janela daquele mesmo throttler 'default' — não
// é um segundo mecanismo, nem um guard adicional: mesmo nome ('default'),
// mesmo guard, valores mais estritos só aqui. Isso preserva exatamente o
// limite que já existia (5 tentativas/60s por padrão, configurável via
// AUTH_RATE_LIMIT_MAX/AUTH_RATE_LIMIT_WINDOW_SECONDS) sem risco de ele ser
// enfraquecido pelo limite global mais permissivo.
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX) || 5;
const AUTH_RATE_LIMIT_TTL_MS =
  (Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS) || 60) * 1000;

@Controller('auth')
@Throttle({
  default: { limit: AUTH_RATE_LIMIT_MAX, ttl: AUTH_RATE_LIMIT_TTL_MS },
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto): Promise<AuthToken> {
    // #region agent log
    fetch('http://127.0.0.1:7850/ingest/a0c66230-f554-475e-a6e9-668a6dd61ce2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '9a24a4',
      },
      body: JSON.stringify({
        sessionId: '9a24a4',
        runId: 'pre-fix',
        hypothesisId: 'H3',
        location: 'auth.controller.ts:login',
        message: 'backend login endpoint hit',
        data: { emailProvided: Boolean(loginDto.email) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return this.authService.login(loginDto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto): Promise<UsuarioPublico> {
    return this.authService.register(registerDto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponse> {
    return this.authService.resetPassword(resetPasswordDto);
  }

  // Etapa 6.4 (Confirmação de e-mail) — pública de propósito, igual a
  // forgot-password/reset-password: quem chama ainda não tem sessão (acabou
  // de clicar num link de e-mail). O token em si é a única credencial.
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<ResendVerificationResponse> {
    return this.authService.resendVerification(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthToken> {
    return this.authService.refresh(refreshTokenDto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() refreshTokenDto: RefreshTokenDto): Promise<LogoutResponse> {
    return this.authService.logout(refreshTokenDto);
  }

  // Etapa 3 (Minha Conta / Segurança) — única rota deste controller que
  // exige sessão ativa (as demais são fluxos pré-autenticação). Guard
  // aplicado só neste método, não na classe: login/register/forgot/reset
  // continuam públicos. Usuário identificado exclusivamente por
  // @CurrentUser() (JWT) — nunca por um id enviado no corpo.
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Body() dto: AlterarMinhaSenhaDto,
    @CurrentUser() user: UsuarioAutenticado,
  ): Promise<ChangePasswordResponse> {
    return this.authService.changePassword(user.id, dto);
  }
}
