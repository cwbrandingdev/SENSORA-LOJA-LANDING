"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
var common_1 = require("@nestjs/common");
var config_1 = require("@nestjs/config");
var Joi = require("joi");
var app_controller_1 = require("./app.controller");
var app_service_1 = require("./app.service");
var auth_module_1 = require("./auth/auth.module");
var categorias_module_1 = require("./categorias/categorias.module");
var checkout_module_1 = require("./checkout/checkout.module");
var clientes_module_1 = require("./clientes/clientes.module");
var enderecos_module_1 = require("./enderecos/enderecos.module");
var imagekit_module_1 = require("./imagekit/imagekit.module");
var itens_pedido_module_1 = require("./itens-pedido/itens-pedido.module");
var pedidos_module_1 = require("./pedidos/pedidos.module");
var prisma_module_1 = require("./prisma/prisma.module");
var produtos_module_1 = require("./produtos/produtos.module");
var public_module_1 = require("./public/public.module");
var usuarios_module_1 = require("./usuarios/usuarios.module");
var AppModule = function () {
    var _classDecorators = [(0, common_1.Module)({
            imports: [
                config_1.ConfigModule.forRoot({
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
                prisma_module_1.PrismaModule,
                produtos_module_1.ProdutosModule,
                categorias_module_1.CategoriasModule,
                checkout_module_1.CheckoutModule,
                clientes_module_1.ClientesModule,
                enderecos_module_1.EnderecosModule,
                pedidos_module_1.PedidosModule,
                itens_pedido_module_1.ItensPedidoModule,
                usuarios_module_1.UsuariosModule,
                auth_module_1.AuthModule,
                public_module_1.PublicModule,
                imagekit_module_1.ImagekitModule,
            ],
            controllers: [app_controller_1.AppController],
            providers: [app_service_1.AppService],
        })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AppModule = _classThis = /** @class */ (function () {
        function AppModule_1() {
        }
        return AppModule_1;
    }());
    __setFunctionName(_classThis, "AppModule");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AppModule = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AppModule = _classThis;
}();
exports.AppModule = AppModule;
