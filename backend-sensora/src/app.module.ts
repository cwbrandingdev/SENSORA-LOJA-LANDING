import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CloudflareAwareThrottlerGuard } from './auth/guards/render-throttler.guard';
import { CategoriasModule } from './categorias/categorias.module';
import { CheckoutModule } from './checkout/checkout.module';
import { ClientesModule } from './clientes/clientes.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EnderecosModule } from './enderecos/enderecos.module';
import { FiscalModule } from './fiscal/fiscal.module';
import { ImagekitModule } from './imagekit/imagekit.module';
import { ItensPedidoModule } from './itens-pedido/itens-pedido.module';
import { MelhorEnvioModule } from './melhor-envio/melhor-envio.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProdutosModule } from './produtos/produtos.module';
import { PublicModule } from './public/public.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        // Etapa 10 / Task 6 (achado H1): exige pelo menos 32 caracteres —
        // sem isso, a aplicação subia normalmente mesmo com um segredo
        // curto/previsível (ex.: o placeholder antigo do .env.example),
        // permitindo forjar um JWT válido para qualquer usuário.
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.number().integer().positive().required(),
        // Task 27 — expiração do refresh token, em segundos. Mesmo padrão
        // de obrigatoriedade explícita de JWT_EXPIRES_IN acima.
        REFRESH_TOKEN_EXPIRES_IN: Joi.number().integer().positive().required(),
        // Task 21 — gateway de checkout ativo. "asaas" é o padrão (migração
        // concluída do lado do frontend, ver LandingPageSensora); "stripe"
        // existe só como rota de rollback, usando o código Stripe original
        // preservado em CheckoutService. Sem ela, a aplicação recusa subir
        // (Task 15), então falha rápido no boot como JWT_SECRET, em vez de
        // deixar a aplicação subir normalmente e só quebrar no primeiro
        // request de checkout — mas agora só exige as credenciais do
        // gateway que está de fato ativo. STRIPE_WEBHOOK_SECRET e
        // ASAAS_WEBHOOK_TOKEN ficam de fora de propósito: só o endpoint de
        // webhook depende delas, e ele já falha sozinho (400) se estiver
        // ausente — mesmo padrão de degradação parcial já usado para
        // IMAGEKIT_*/RESEND_API_KEY (ver .env.example).
        CHECKOUT_GATEWAY: Joi.string()
          .valid('asaas', 'stripe')
          .default('asaas'),
        STRIPE_SECRET_KEY: Joi.string().when('CHECKOUT_GATEWAY', {
          is: 'stripe',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        ASAAS_API_KEY: Joi.string().when('CHECKOUT_GATEWAY', {
          is: 'asaas',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        ASAAS_BASE_URL: Joi.string().when('CHECKOUT_GATEWAY', {
          is: 'asaas',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        // Etapa 6.5 (Frete) — todas opcionais na validação de boot
        // (diferente de ASAAS_*, que já bloqueiam o startup): MelhorEnvioService
        // valida preguiçosamente (mesmo padrão de AsaasService), lançando só
        // quando efetivamente chamado sem estar configurado. Isso evita
        // quebrar ambientes (dev/CI) que ainda não têm uma conta Melhor
        // Envio conectada — a funcionalidade de frete é nova, ainda não é
        // universalmente obrigatória para a aplicação subir.
        MELHOR_ENVIO_ENV: Joi.string().valid('sandbox', 'production'),
        MELHOR_ENVIO_CLIENT_ID: Joi.string(),
        MELHOR_ENVIO_CLIENT_SECRET: Joi.string(),
        MELHOR_ENVIO_REDIRECT_URI: Joi.string(),
        MELHOR_ENVIO_SCOPE: Joi.string(),
        MELHOR_ENVIO_USER_AGENT: Joi.string(),
        MELHOR_ENVIO_CEP_ORIGEM: Joi.string(),
        MELHOR_ENVIO_PACOTE_ALTURA_CM: Joi.number().positive(),
        MELHOR_ENVIO_PACOTE_LARGURA_CM: Joi.number().positive(),
        MELHOR_ENVIO_PACOTE_COMPRIMENTO_CM: Joi.number().positive(),
        MELHOR_ENVIO_PACOTE_PESO_GRAMAS: Joi.number().positive(),
      }),
    }),
    // CFG-01 (achado da auditoria) — throttler global leve, cobrindo por
    // padrão TODAS as rotas do app (aplicado via APP_GUARD abaixo), incluindo
    // as que antes não tinham nenhum limite (ex.: GET /public/produtos, que
    // aceitava bursts ilimitados). Limite pensado para não incomodar
    // navegação normal (uma página da loja facilmente dispara vários GETs
    // em paralelo) mas ainda barrar abuso: 30 requisições / 10s por IP
    // rastreado (mesma lógica de tracker do CloudflareAwareThrottlerGuard
    // já existente, reaproveitado abaixo — nenhuma implementação nova de
    // rate limiting, só uma segunda entrada de configuração). Configurável
    // via .env (GLOBAL_RATE_LIMIT_MAX / GLOBAL_RATE_LIMIT_WINDOW_SECONDS),
    // mesmo padrão de fallback já usado por AUTH_RATE_LIMIT_MAX/WINDOW_SECONDS
    // em AuthController.
    //
    // O throttler 'auth' (5 tentativas/60s) que já existia só para o
    // AuthController continua com o MESMO valor, agora expresso como um
    // override via @Throttle() no próprio controller (ver auth.controller.ts)
    // em vez de um guard/módulo Throttler separado — evita duas limitações
    // independentes competindo pela mesma requisição e garante que o limite
    // de auth nunca fica mais fraco que antes.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            limit:
              Number(configService.get<string>('GLOBAL_RATE_LIMIT_MAX')) ||
              30,
            ttl:
              (Number(
                configService.get<string>(
                  'GLOBAL_RATE_LIMIT_WINDOW_SECONDS',
                ),
              ) || 10) * 1000,
          },
        ],
      }),
    }),
    PrismaModule,
    ProdutosModule,
    CategoriasModule,
    CheckoutModule,
    ClientesModule,
    DashboardModule,
    EnderecosModule,
    FiscalModule,
    MelhorEnvioModule,
    PedidosModule,
    ItensPedidoModule,
    UsuariosModule,
    AuthModule,
    PublicModule,
    ImagekitModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // CFG-01 — registra o throttler acima como guard global (roda em toda
    // requisição, para todo controller, sem precisar de @UseGuards() em
    // cada um). Reaproveita o CloudflareAwareThrottlerGuard já existente
    // (Etapa 8.11) só para a identificação de IP atrás do Render/Cloudflare
    // — nenhum guard novo foi criado.
    { provide: APP_GUARD, useClass: CloudflareAwareThrottlerGuard },
  ],
})
export class AppModule {}
