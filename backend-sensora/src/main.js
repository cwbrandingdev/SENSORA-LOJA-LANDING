"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var common_1 = require("@nestjs/common");
var config_1 = require("@nestjs/config");
var core_1 = require("@nestjs/core");
var swagger_1 = require("@nestjs/swagger");
var helmet_1 = require("helmet");
var app_module_1 = require("./app.module");
var all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
// Etapa 10 / Task 6 (achado H9): limite de tamanho do body em bytes,
// aplicado a JSON e a application/x-www-form-urlencoded. Só torna explícito
// o valor que já era o default implícito do body-parser (Express/Nest) —
// não muda o comportamento atual, só documenta a intenção no código.
// Nenhuma rota deste backend recebe arquivo binário no body (o upload de
// imagem vai direto do navegador para o ImageKit usando o token assinado
// por GET /imagekit/auth, nunca passa por aqui), então esse limite não
// afeta o fluxo de upload.
var BODY_SIZE_LIMIT = '100kb';
function bootstrap() {
    return __awaiter(this, void 0, void 0, function () {
        var app, configService, DEFAULT_CORS_ORIGINS, corsOriginEnv, corsOriginsFromEnv, corsOrigins, isProducao, swaggerConfig, swaggerDocument;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, core_1.NestFactory.create(app_module_1.AppModule, {
                        bodyParser: false,
                        rawBody: true,
                    })];
                case 1:
                    app = _c.sent();
                    app.useBodyParser('json', { limit: BODY_SIZE_LIMIT });
                    app.useBodyParser('urlencoded', { limit: BODY_SIZE_LIMIT, extended: true });
                    // Etapa 10 / Task 6 (achado H3): hardening padrão de headers HTTP —
                    // remove X-Powered-By e adiciona os headers defensivos padrão do
                    // Helmet (X-Content-Type-Options, X-Frame-Options, Referrer-Policy
                    // etc.). Sem configuração customizada: a API é JSON puro, não serve
                    // HTML/recursos externos, então a política default do Helmet já é
                    // adequada sem precisar ajustar CSP manualmente.
                    app.use((0, helmet_1.default)());
                    configService = app.get(config_1.ConfigService);
                    DEFAULT_CORS_ORIGINS = [
                        'http://localhost:3001',
                        'http://localhost:3002',
                    ];
                    corsOriginEnv = configService.get('CORS_ORIGIN');
                    corsOriginsFromEnv = corsOriginEnv
                        ? corsOriginEnv
                            .split(',')
                            .map(function (origin) { return origin.trim(); })
                            .filter(function (origin) { return origin.length > 0; })
                        : [];
                    corsOrigins = corsOriginsFromEnv.length > 0 ? corsOriginsFromEnv : DEFAULT_CORS_ORIGINS;
                    app.enableCors({
                        origin: corsOrigins,
                        credentials: true,
                    });
                    app.useGlobalPipes(new common_1.ValidationPipe({
                        whitelist: true,
                        transform: true,
                        forbidNonWhitelisted: true,
                    }));
                    // Etapa 10 / Task 6 (achados H5 + H6): filtro global único — trata
                    // HttpException exatamente como antes e captura qualquer outra exceção
                    // (Prisma, infraestrutura, bug inesperado) como 500 genérico, com log
                    // apenas no servidor. Ver comentários em all-exceptions.filter.ts.
                    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
                    isProducao = configService.get('NODE_ENV') === 'production';
                    if (!isProducao) {
                        swaggerConfig = new swagger_1.DocumentBuilder()
                            .setTitle('ATRIA ERP API')
                            .setDescription('API Backend do sistema ATRIA ERP')
                            .setVersion('1.0')
                            .addBearerAuth()
                            .build();
                        swaggerDocument = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
                        swagger_1.SwaggerModule.setup('api', app, swaggerDocument);
                    }
                    return [4 /*yield*/, app.listen((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3000)];
                case 2:
                    _c.sent();
                    console.log('App rodando na porta: ', (_b = process.env.PORT) !== null && _b !== void 0 ? _b : 3000);
                    return [2 /*return*/];
            }
        });
    });
}
bootstrap();
