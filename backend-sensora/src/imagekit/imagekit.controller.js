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
exports.ImagekitController = void 0;
var common_1 = require("@nestjs/common");
var jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
var roles_decorator_1 = require("../common/decorators/roles.decorator");
var roles_constants_1 = require("../common/constants/roles.constants");
var roles_guard_1 = require("../common/guards/roles.guard");
// Etapa 7: a checagem manual de perfil que existia aqui foi substituída pelo
// RolesGuard reutilizável (mesmo mecanismo agora usado em /produtos,
// /categorias, /clientes, /pedidos, /itens-pedido). Liberado para
// ADMIN + VENDEDOR — sem isso, VENDEDOR não conseguiria subir imagem ao
// gerenciar produtos.
var ImagekitController = function () {
    var _classDecorators = [(0, common_1.Controller)('imagekit'), (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard), roles_decorator_1.Roles.apply(void 0, roles_constants_1.STAFF_ROLES)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _auth_decorators;
    var ImagekitController = _classThis = /** @class */ (function () {
        function ImagekitController_1(imagekitService) {
            this.imagekitService = (__runInitializers(this, _instanceExtraInitializers), imagekitService);
        }
        ImagekitController_1.prototype.auth = function () {
            return this.imagekitService.gerarParametrosAutenticacao();
        };
        return ImagekitController_1;
    }());
    __setFunctionName(_classThis, "ImagekitController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _auth_decorators = [(0, common_1.Get)('auth')];
        __esDecorate(_classThis, null, _auth_decorators, { kind: "method", name: "auth", static: false, private: false, access: { has: function (obj) { return "auth" in obj; }, get: function (obj) { return obj.auth; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ImagekitController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ImagekitController = _classThis;
}();
exports.ImagekitController = ImagekitController;
