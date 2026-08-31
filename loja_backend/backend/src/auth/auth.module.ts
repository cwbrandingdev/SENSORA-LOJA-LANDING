import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { MailModule } from '../mail/mail.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsuariosModule,
    MailModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            Number(configService.get<string>('JWT_EXPIRES_IN')) || 3600,
        },
      }),
    }),
    // Etapa 10 / Task 4 (achado A2): limite de tentativas só para as rotas
    // de auth (login, register, forgot-password, reset-password) — o guard
    // é aplicado apenas em AuthController (ver auth.controller.ts), nunca
    // registrado como APP_GUARD global, então nenhum outro endpoint do
    // sistema é afetado. Um único "tier" cobre as 4 rotas; cada uma tem seu
    // próprio contador (chave do throttler inclui a rota), então esgotar o
    // limite do login não consome o limite do forgot-password. Valores
    // configuráveis via .env (ver .env.example); padrão pensado para
    // suportar erro de digitação humano sem abrir margem para brute force.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            limit:
              Number(configService.get<string>('AUTH_RATE_LIMIT_MAX')) || 5,
            ttl:
              (Number(
                configService.get<string>('AUTH_RATE_LIMIT_WINDOW_SECONDS'),
              ) || 60) * 1000,
          },
        ],
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
