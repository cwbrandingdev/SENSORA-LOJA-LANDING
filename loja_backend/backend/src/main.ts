import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Etapa 10 / Task 6 (achado H9): limite de tamanho do body em bytes,
// aplicado a JSON e a application/x-www-form-urlencoded. Só torna explícito
// o valor que já era o default implícito do body-parser (Express/Nest) —
// não muda o comportamento atual, só documenta a intenção no código.
// Nenhuma rota deste backend recebe arquivo binário no body (o upload de
// imagem vai direto do navegador para o ImageKit usando o token assinado
// por GET /imagekit/auth, nunca passa por aqui), então esse limite não
// afeta o fluxo de upload.
const BODY_SIZE_LIMIT = '100kb';

async function bootstrap() {
  // bodyParser:false desliga o registro automático dos parsers padrão do
  // Nest para podermos registrar json/urlencoded manualmente logo abaixo
  // com o limite explícito, sem duplicar o middleware. rawBody:true (Task
  // 15) faz o Nest guardar o corpo bruto (Buffer, antes do parse) em
  // req.rawBody em paralelo ao req.body já parseado — indispensável para
  // stripe.webhooks.constructEvent() validar a assinatura HMAC do Stripe,
  // que precisa dos bytes exatos recebidos, byte a byte. Reconstruir isso
  // via JSON.stringify(req.body) NÃO funciona: a re-serialização não
  // reproduz garantidamente os mesmos bytes (ordem de chaves, espaçamento),
  // então a assinatura calculada não bateria nunca — rawBody:true é a única
  // forma correta, e funciona tanto com o parser padrão quanto com os
  // parsers registrados via app.useBodyParser() abaixo.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    rawBody: true,
  });
  app.useBodyParser('json', { limit: BODY_SIZE_LIMIT });
  app.useBodyParser('urlencoded', { limit: BODY_SIZE_LIMIT, extended: true });

  // Etapa 10 / Task 6 (achado H3): hardening padrão de headers HTTP —
  // remove X-Powered-By e adiciona os headers defensivos padrão do
  // Helmet (X-Content-Type-Options, X-Frame-Options, Referrer-Policy
  // etc.). Sem configuração customizada: a API é JSON puro, não serve
  // HTML/recursos externos, então a política default do Helmet já é
  // adequada sem precisar ajustar CSP manualmente.
  app.use(helmet());

  const configService = app.get(ConfigService);

  // Etapa 10 / Task 6 (achado H4): lista de origens do CORS configurável
  // por CORS_ORIGIN (separada por vírgula), sem nunca cair para "*" — o
  // fallback, quando a variável está ausente ou vazia, é exatamente a
  // mesma lista fixa que já existia antes desta Task. credentials:true
  // continua obrigatoriamente combinado com uma lista fechada de origens,
  // nunca com wildcard.
  const DEFAULT_CORS_ORIGINS = [
    'http://localhost:3001',
    'http://localhost:3002',
  ];
  const corsOriginEnv = configService.get<string>('CORS_ORIGIN');
  const corsOriginsFromEnv = corsOriginEnv
    ? corsOriginEnv
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    : [];
  const corsOrigins =
    corsOriginsFromEnv.length > 0 ? corsOriginsFromEnv : DEFAULT_CORS_ORIGINS;

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // Etapa 10 / Task 6 (achados H5 + H6): filtro global único — trata
  // HttpException exatamente como antes e captura qualquer outra exceção
  // (Prisma, infraestrutura, bug inesperado) como 500 genérico, com log
  // apenas no servidor. Ver comentários em all-exceptions.filter.ts.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Etapa 10 / Task 6 (achado H2): em produção, /api não deve expor a
  // documentação completa das rotas/DTOs sem nenhuma proteção. Fora de
  // produção (dev, sem NODE_ENV definido, etc.), o Swagger continua
  // disponível normalmente, sem exigir autenticação extra.
  const isProducao = configService.get<string>('NODE_ENV') === 'production';

  if (!isProducao) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ATRIA ERP API')
      .setDescription('API Backend do sistema ATRIA ERP')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, swaggerDocument);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
