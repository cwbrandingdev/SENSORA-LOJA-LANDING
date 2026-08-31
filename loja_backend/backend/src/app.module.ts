import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CategoriasModule } from './categorias/categorias.module';
import { CheckoutModule } from './checkout/checkout.module';
import { ClientesModule } from './clientes/clientes.module';
import { EnderecosModule } from './enderecos/enderecos.module';
import { ImagekitModule } from './imagekit/imagekit.module';
import { ItensPedidoModule } from './itens-pedido/itens-pedido.module';
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
      }),
    }),
    PrismaModule,
    ProdutosModule,
    CategoriasModule,
    CheckoutModule,
    ClientesModule,
    EnderecosModule,
    PedidosModule,
    ItensPedidoModule,
    UsuariosModule,
    AuthModule,
    PublicModule,
    ImagekitModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
