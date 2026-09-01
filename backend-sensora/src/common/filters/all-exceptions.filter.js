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
exports.AllExceptionsFilter = void 0;
var common_1 = require("@nestjs/common");
var GENERIC_SERVER_ERROR_MESSAGE = 'Internal server error';
// Etapa 10 / Task 6 (achados H5 + H6): substitui o antigo
// HttpExceptionFilter (@Catch(HttpException) apenas) por um filtro global
// único — evita duplicar a lógica de extrair status/message de uma
// HttpException, que continua exatamente igual a antes (ver
// resolverResposta). A diferença é que agora QUALQUER exceção que não seja
// uma HttpException (erro do Prisma, falha de infraestrutura, bug não
// previsto) também é capturada aqui, em vez de cair no handler padrão do
// Nest fora do nosso controle: vira 500 genérico para o cliente, com o
// erro real (stack trace) só no log do servidor.
//
// NUNCA logar aqui: corpo da requisição, headers (Authorization/cookies),
// senha, token, JWT_SECRET, IMAGEKIT_PRIVATE_KEY ou qualquer outro dado do
// payload — só method/path/status/stack trace da própria exceção.
var AllExceptionsFilter = function () {
    var _classDecorators = [(0, common_1.Catch)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AllExceptionsFilter = _classThis = /** @class */ (function () {
        function AllExceptionsFilter_1() {
            this.logger = new common_1.Logger(AllExceptionsFilter.name);
        }
        AllExceptionsFilter_1.prototype.catch = function (exception, host) {
            var ctx = host.switchToHttp();
            var response = ctx.getResponse();
            var request = ctx.getRequest();
            var _a = this.resolverResposta(exception), statusCode = _a.statusCode, message = _a.message;
            if (statusCode >= 500) {
                this.logger.error("".concat(request.method, " ").concat(request.url, " -> ").concat(statusCode), exception instanceof Error ? exception.stack : String(exception));
            }
            response.status(statusCode).json({
                statusCode: statusCode,
                timestamp: new Date().toISOString(),
                path: request.url,
                message: message,
            });
        };
        AllExceptionsFilter_1.prototype.resolverResposta = function (exception) {
            if (exception instanceof common_1.HttpException) {
                var statusCode = exception.getStatus();
                var exceptionResponse = exception.getResponse();
                var message = typeof exceptionResponse === 'string'
                    ? exceptionResponse
                    : exceptionResponse.message;
                return { statusCode: statusCode, message: message };
            }
            // Qualquer exceção não-HTTP (ex.: PrismaClientKnownRequestError, erro
            // de conexão, bug inesperado) nunca deve chegar ao cliente com detalhe
            // interno — sempre 500 genérico. O @Catch() global é suficiente para
            // isso; não há necessidade de distinguir códigos específicos do Prisma
            // aqui, porque os fluxos que precisam de um status diferenciado (ex.:
            // 409 ao excluir produto/categoria vinculados) já fazem essa checagem
            // manualmente antes de chegar num erro do Prisma (ver
            // produtos.service.ts/categorias.service.ts) — um erro do Prisma que
            // chegue até aqui é, por definição, um caso não previsto.
            return {
                statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                message: GENERIC_SERVER_ERROR_MESSAGE,
            };
        };
        return AllExceptionsFilter_1;
    }());
    __setFunctionName(_classThis, "AllExceptionsFilter");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AllExceptionsFilter = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AllExceptionsFilter = _classThis;
}();
exports.AllExceptionsFilter = AllExceptionsFilter;
