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
exports.ImagekitService = void 0;
var common_1 = require("@nestjs/common");
var imagekit_1 = require("imagekit");
// IMAGEKIT_PUBLIC_KEY/IMAGEKIT_PRIVATE_KEY/IMAGEKIT_URL_ENDPOINT não estão no
// ConfigModule.validationSchema (app.module.ts) de propósito: são opcionais
// para o boot da aplicação (assim como as demais rotas continuam de pé sem
// elas configuradas) e só passam a ser exigidas quando alguém efetivamente
// chama GET /imagekit/auth — ver isConfigured()/gerarParametrosAutenticacao().
var ImagekitService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ImagekitService = _classThis = /** @class */ (function () {
        function ImagekitService_1(configService) {
            this.configService = configService;
            var publicKey = this.configService.get('IMAGEKIT_PUBLIC_KEY');
            var privateKey = this.configService.get('IMAGEKIT_PRIVATE_KEY');
            var urlEndpoint = this.configService.get('IMAGEKIT_URL_ENDPOINT');
            if (publicKey && privateKey && urlEndpoint) {
                this.client = new imagekit_1.default({ publicKey: publicKey, privateKey: privateKey, urlEndpoint: urlEndpoint });
                this.publicKey = publicKey;
                this.urlEndpoint = urlEndpoint;
            }
            else {
                this.client = null;
            }
        }
        ImagekitService_1.prototype.isConfigured = function () {
            return this.client !== null;
        };
        // Gera token/expire/signature sob demanda a cada chamada (nunca persiste
        // nada em banco) usando o SDK oficial — a privateKey nunca sai deste
        // método: getAuthenticationParameters() só a usa internamente para
        // calcular o HMAC da signature.
        ImagekitService_1.prototype.gerarParametrosAutenticacao = function () {
            if (!this.client || !this.publicKey || !this.urlEndpoint) {
                // Etapa 10 / Task 6 (achado H10): mensagem genérica — a versão
                // anterior citava os nomes exatos das variáveis de ambiente
                // ausentes na resposta ao cliente, informação interna que não deve
                // sair da aplicação (mesmo que só STAFF autenticado veja essa rota).
                throw new common_1.InternalServerErrorException('ImageKit não está configurado neste ambiente.');
            }
            var _a = this.client.getAuthenticationParameters(), token = _a.token, expire = _a.expire, signature = _a.signature;
            return {
                token: token,
                expire: expire,
                signature: signature,
                publicKey: this.publicKey,
                urlEndpoint: this.urlEndpoint,
            };
        };
        return ImagekitService_1;
    }());
    __setFunctionName(_classThis, "ImagekitService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ImagekitService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ImagekitService = _classThis;
}();
exports.ImagekitService = ImagekitService;
