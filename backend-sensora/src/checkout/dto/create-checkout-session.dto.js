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
exports.CreateCheckoutSessionDto = exports.CheckoutItemDto = void 0;
var class_validator_1 = require("class-validator");
var class_transformer_1 = require("class-transformer");
var CheckoutItemDto = function () {
    var _a;
    var _produtoId_decorators;
    var _produtoId_initializers = [];
    var _produtoId_extraInitializers = [];
    var _quantidade_decorators;
    var _quantidade_initializers = [];
    var _quantidade_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CheckoutItemDto() {
                this.produtoId = __runInitializers(this, _produtoId_initializers, void 0);
                this.quantidade = (__runInitializers(this, _produtoId_extraInitializers), __runInitializers(this, _quantidade_initializers, void 0));
                __runInitializers(this, _quantidade_extraInitializers);
            }
            return CheckoutItemDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _produtoId_decorators = [(0, class_validator_1.IsInt)(), (0, class_validator_1.IsPositive)()];
            _quantidade_decorators = [(0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(1)];
            __esDecorate(null, null, _produtoId_decorators, { kind: "field", name: "produtoId", static: false, private: false, access: { has: function (obj) { return "produtoId" in obj; }, get: function (obj) { return obj.produtoId; }, set: function (obj, value) { obj.produtoId = value; } }, metadata: _metadata }, _produtoId_initializers, _produtoId_extraInitializers);
            __esDecorate(null, null, _quantidade_decorators, { kind: "field", name: "quantidade", static: false, private: false, access: { has: function (obj) { return "quantidade" in obj; }, get: function (obj) { return obj.quantidade; }, set: function (obj, value) { obj.quantidade = value; } }, metadata: _metadata }, _quantidade_initializers, _quantidade_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CheckoutItemDto = CheckoutItemDto;
var CreateCheckoutSessionDto = function () {
    var _a;
    var _itens_decorators;
    var _itens_initializers = [];
    var _itens_extraInitializers = [];
    var _clienteEmail_decorators;
    var _clienteEmail_initializers = [];
    var _clienteEmail_extraInitializers = [];
    var _clienteNome_decorators;
    var _clienteNome_initializers = [];
    var _clienteNome_extraInitializers = [];
    var _enderecoId_decorators;
    var _enderecoId_initializers = [];
    var _enderecoId_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateCheckoutSessionDto() {
                this.itens = __runInitializers(this, _itens_initializers, void 0);
                this.clienteEmail = (__runInitializers(this, _itens_extraInitializers), __runInitializers(this, _clienteEmail_initializers, void 0));
                this.clienteNome = (__runInitializers(this, _clienteEmail_extraInitializers), __runInitializers(this, _clienteNome_initializers, void 0));
                this.enderecoId = (__runInitializers(this, _clienteNome_extraInitializers), __runInitializers(this, _enderecoId_initializers, void 0));
                __runInitializers(this, _enderecoId_extraInitializers);
            }
            return CreateCheckoutSessionDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _itens_decorators = [(0, class_validator_1.IsArray)(), (0, class_validator_1.ValidateNested)({ each: true }), (0, class_transformer_1.Type)(function () { return CheckoutItemDto; })];
            _clienteEmail_decorators = [(0, class_validator_1.IsEmail)(), (0, class_validator_1.IsNotEmpty)()];
            _clienteNome_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _enderecoId_decorators = [(0, class_validator_1.IsInt)(), (0, class_validator_1.IsPositive)()];
            __esDecorate(null, null, _itens_decorators, { kind: "field", name: "itens", static: false, private: false, access: { has: function (obj) { return "itens" in obj; }, get: function (obj) { return obj.itens; }, set: function (obj, value) { obj.itens = value; } }, metadata: _metadata }, _itens_initializers, _itens_extraInitializers);
            __esDecorate(null, null, _clienteEmail_decorators, { kind: "field", name: "clienteEmail", static: false, private: false, access: { has: function (obj) { return "clienteEmail" in obj; }, get: function (obj) { return obj.clienteEmail; }, set: function (obj, value) { obj.clienteEmail = value; } }, metadata: _metadata }, _clienteEmail_initializers, _clienteEmail_extraInitializers);
            __esDecorate(null, null, _clienteNome_decorators, { kind: "field", name: "clienteNome", static: false, private: false, access: { has: function (obj) { return "clienteNome" in obj; }, get: function (obj) { return obj.clienteNome; }, set: function (obj, value) { obj.clienteNome = value; } }, metadata: _metadata }, _clienteNome_initializers, _clienteNome_extraInitializers);
            __esDecorate(null, null, _enderecoId_decorators, { kind: "field", name: "enderecoId", static: false, private: false, access: { has: function (obj) { return "enderecoId" in obj; }, get: function (obj) { return obj.enderecoId; }, set: function (obj, value) { obj.enderecoId = value; } }, metadata: _metadata }, _enderecoId_initializers, _enderecoId_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateCheckoutSessionDto = CreateCheckoutSessionDto;
