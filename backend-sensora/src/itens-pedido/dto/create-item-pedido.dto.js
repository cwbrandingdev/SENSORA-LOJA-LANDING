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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateItemPedidoDto = void 0;
var class_validator_1 = require("class-validator");
var CreateItemPedidoDto = function () {
    var _a;
    var _pedidoId_decorators;
    var _pedidoId_initializers = [];
    var _pedidoId_extraInitializers = [];
    var _produtoId_decorators;
    var _produtoId_initializers = [];
    var _produtoId_extraInitializers = [];
    var _quantidade_decorators;
    var _quantidade_initializers = [];
    var _quantidade_extraInitializers = [];
    var _precoUnitario_decorators;
    var _precoUnitario_initializers = [];
    var _precoUnitario_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateItemPedidoDto() {
                this.pedidoId = __runInitializers(this, _pedidoId_initializers, void 0);
                this.produtoId = (__runInitializers(this, _pedidoId_extraInitializers), __runInitializers(this, _produtoId_initializers, void 0));
                this.quantidade = (__runInitializers(this, _produtoId_extraInitializers), __runInitializers(this, _quantidade_initializers, void 0));
                this.precoUnitario = (__runInitializers(this, _quantidade_extraInitializers), __runInitializers(this, _precoUnitario_initializers, void 0));
                __runInitializers(this, _precoUnitario_extraInitializers);
            }
            return CreateItemPedidoDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _pedidoId_decorators = [(0, class_validator_1.IsInt)(), (0, class_validator_1.IsPositive)()];
            _produtoId_decorators = [(0, class_validator_1.IsInt)(), (0, class_validator_1.IsPositive)()];
            _quantidade_decorators = [(0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1)];
            _precoUnitario_decorators = [(0, class_validator_1.IsNumber)(), (0, class_validator_1.Min)(0)];
            __esDecorate(null, null, _pedidoId_decorators, { kind: "field", name: "pedidoId", static: false, private: false, access: { has: function (obj) { return "pedidoId" in obj; }, get: function (obj) { return obj.pedidoId; }, set: function (obj, value) { obj.pedidoId = value; } }, metadata: _metadata }, _pedidoId_initializers, _pedidoId_extraInitializers);
            __esDecorate(null, null, _produtoId_decorators, { kind: "field", name: "produtoId", static: false, private: false, access: { has: function (obj) { return "produtoId" in obj; }, get: function (obj) { return obj.produtoId; }, set: function (obj, value) { obj.produtoId = value; } }, metadata: _metadata }, _produtoId_initializers, _produtoId_extraInitializers);
            __esDecorate(null, null, _quantidade_decorators, { kind: "field", name: "quantidade", static: false, private: false, access: { has: function (obj) { return "quantidade" in obj; }, get: function (obj) { return obj.quantidade; }, set: function (obj, value) { obj.quantidade = value; } }, metadata: _metadata }, _quantidade_initializers, _quantidade_extraInitializers);
            __esDecorate(null, null, _precoUnitario_decorators, { kind: "field", name: "precoUnitario", static: false, private: false, access: { has: function (obj) { return "precoUnitario" in obj; }, get: function (obj) { return obj.precoUnitario; }, set: function (obj, value) { obj.precoUnitario = value; } }, metadata: _metadata }, _precoUnitario_initializers, _precoUnitario_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateItemPedidoDto = CreateItemPedidoDto;
