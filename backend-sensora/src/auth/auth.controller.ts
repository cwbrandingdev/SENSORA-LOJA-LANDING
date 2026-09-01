import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuarioPublico } from '../usuarios/entities/usuario.entity';
import { AuthService } from './auth.service';
import { AlterarMinhaSenhaDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthToken } from './entities/auth-token.entity';
import { ChangePasswordResponse } from './entities/change-password-response.entity';
import { ForgotPasswordResponse } from './entities/forgot-password-response.entity';
import { LogoutResponse } from './entities/logout-response.entity';
import { ResetPasswordResponse } from './entities/reset-password-response.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// Etapa 10 / Task 4 (achado A2): ThrottlerGuard só neste controller — as
// rotas abaixo são exatamente todas as rotas de auth existentes (Task 27
// acrescentou refresh/logout às 4 originais), então aplicar no nível da
// classe cobre todas sem precisar decorar uma por uma (e cobre
// automaticamente qualquer rota de auth futura, sem risco de esquecer
// alguma). Nenhum outro controller do sistema é afetado.
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto): Promise<AuthToken> {
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
