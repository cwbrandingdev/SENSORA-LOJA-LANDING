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
exports.PublicController = void 0;
var common_1 = require("@nestjs/common");
var PublicController = function () {
    var _classDecorators = [(0, common_1.Controller)('public')];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _listarProdutos_decorators;
    var _buscarProdutoPorSlug_decorators;
    var _listarCategorias_decorators;
    var PublicController = _classThis = /** @class */ (function () {
        function PublicController_1(publicService) {
            this.publicService = (__runInitializers(this, _instanceExtraInitializers), publicService);
        }
        PublicController_1.prototype.listarProdutos = function () {
            return this.publicService.listarProdutos();
        };
        PublicController_1.prototype.buscarProdutoPorSlug = function (slug) {
            return this.publicService.buscarProdutoPorSlug(slug);
        };
        PublicController_1.prototype.listarCategorias = function () {
            return this.publicService.listarCategorias();
        };
        return PublicController_1;
    }());
    __setFunctionName(_classThis, "PublicController");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _listarProdutos_decorators = [(0, common_1.Get)('produtos')];
        _buscarProdutoPorSlug_decorators = [(0, common_1.Get)('produtos/:slug')];
        _listarCategorias_decorators = [(0, common_1.Get)('categorias')];
        __esDecorate(_classThis, null, _listarProdutos_decorators, { kind: "method", name: "listarProdutos", static: false, private: false, access: { has: function (obj) { return "listarProdutos" in obj; }, get: function (obj) { return obj.listarProdutos; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _buscarProdutoPorSlug_decorators, { kind: "method", name: "buscarProdutoPorSlug", static: false, private: false, access: { has: function (obj) { return "buscarProdutoPorSlug" in obj; }, get: function (obj) { return obj.buscarProdutoPorSlug; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(_classThis, null, _listarCategorias_decorators, { kind: "method", name: "listarCategorias", static: false, private: false, access: { has: function (obj) { return "listarCategorias" in obj; }, get: function (obj) { return obj.listarCategorias; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PublicController = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PublicController = _classThis;
}();
exports.PublicController = PublicController;
