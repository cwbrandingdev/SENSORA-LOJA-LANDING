"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
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
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutController = void 0;
var common_1 = require("@nestjs/common");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var CheckoutController = function () {
    var _classDecorators = [(0, common_1.Controller)('checkout')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _createSession_decorators;
    var _getSessionStatus_decorators;
    var _handleWebhook_decorators;
    var CheckoutController = _classThis = /** @class */ (function () {
        function CheckoutController_1(checkoutService) {
            this.checkoutService = (__runInitializers(this, _instanceExtraInitializers), checkoutService);
        }
        CheckoutController_1.prototype.createSession = function (dto, req) {
            return this.checkoutService.createSession(dto, req.user.id);
        };
        CheckoutController_1.prototype.getSessionStatus = function (sessionId) {
            return this.checkoutService.getSessionStatus(sessionId);
        };
        // Task 15/21 — endpoint público de propósito (o gateway de pagamento é
        // quem chama, nunca o frontend/um usuário autenticado): a única
        // "autenticação" válida aqui é verificada dentro de
        // CheckoutService.handleWebhook (assinatura HMAC via
        // STRIPE_WEBHOOK_SECRET no modo Stripe, token via ASAAS_WEBHOOK_TOKEN no
        // modo Asaas), nunca um JwtAuthGuard. Ambos os headers são só repassados
        // aqui — o serviço decide qual usar de acordo com CHECKOUT_GATEWAY.
        // Nenhum dado do corpo é confiado antes dessa verificação.
        CheckoutController_1.prototype.handleWebhook = function (stripeSignature, asaasAccessToken, req) {
            var rawBody = req.rawBody;
            if (!rawBody) {
                throw new Error('Raw body não disponível para webhook de checkout');
            }
            return this.checkoutService.handleWebhook({ stripeSignature: stripeSignature, asaasAccessToken: asaasAccessToken }, rawBody);
        };
        return CheckoutController_1;
    }());
    __setFunctionName(_classThis, "CheckoutController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _createSession_decorators = [(0, common_1.Post)('session'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard), (0, common_1.HttpCode)(common_1.HttpStatus.CREATED)];
        _getSessionStatus_decorators = [(0, common_1.Get)('session/:sessionId'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard)];
        _handleWebhook_decorators = [(0, common_1.Post)('webhook'), (0, common_1.HttpCode)(common_1.HttpStatus.OK)];
        __esDecorate(_classThis, null, _createSession_decorators, { kind: "method", name: "createSession", static: false, private: false, access: { has: function (obj) { return "createSession" in obj; }, get: function (obj) { return obj.createSession; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _getSessionStatus_decorators, { kind: "method", name: "getSessionStatus", static: false, private: false, access: { has: function (obj) { return "getSessionStatus" in obj; }, get: function (obj) { return obj.getSessionStatus; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _handleWebhook_decorators, { kind: "method", name: "handleWebhook", static: false, private: false, access: { has: function (obj) { return "handleWebhook" in obj; }, get: function (obj) { return obj.handleWebhook; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CheckoutController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CheckoutController = _classThis;
}();
exports.CheckoutController = CheckoutController;
