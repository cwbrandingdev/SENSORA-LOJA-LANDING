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
exports.CreateClienteDto = void 0;
var class_validator_1 = require("class-validator");
var CreateClienteDto = function () {
    var _a;
    var _nome_decorators;
    var _nome_initializers = [];
    var _nome_extraInitializers = [];
    var _email_decorators;
    var _email_initializers = [];
    var _email_extraInitializers = [];
    var _telefone_decorators;
    var _telefone_initializers = [];
    var _telefone_extraInitializers = [];
    var _cpf_decorators;
    var _cpf_initializers = [];
    var _cpf_extraInitializers = [];
    var _endereco_decorators;
    var _endereco_initializers = [];
    var _endereco_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateClienteDto() {
                // Etapa 10 / Task 6 (achado H8): limite nos campos de texto livre (nome,
                // endereço). telefone/cpf ficaram de fora deliberadamente — são campos
                // estruturados/de formato fixo, não texto livre, e validar o formato
                // deles é um achado separado (não pedido nesta Task).
                this.nome = __runInitializers(this, _nome_initializers, void 0);
                this.email = (__runInitializers(this, _nome_extraInitializers), __runInitializers(this, _email_initializers, void 0));
                this.telefone = (__runInitializers(this, _email_extraInitializers), __runInitializers(this, _telefone_initializers, void 0));
                this.cpf = (__runInitializers(this, _telefone_extraInitializers), __runInitializers(this, _cpf_initializers, void 0));
                this.endereco = (__runInitializers(this, _cpf_extraInitializers), __runInitializers(this, _endereco_initializers, void 0));
                __runInitializers(this, _endereco_extraInitializers);
            }
            return CreateClienteDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _nome_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.MaxLength)(150)];
            _email_decorators = [(0, class_validator_1.IsEmail)()];
            _telefone_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _cpf_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)()];
            _endereco_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.MaxLength)(300)];
            __esDecorate(null, null, _nome_decorators, { kind: "field", name: "nome", static: false, private: false, access: { has: function (obj) { return "nome" in obj; }, get: function (obj) { return obj.nome; }, set: function (obj, value) { obj.nome = value; } }, metadata: _metadata }, _nome_initializers, _nome_extraInitializers);
            __esDecorate(null, null, _email_decorators, { kind: "field", name: "email", static: false, private: false, access: { has: function (obj) { return "email" in obj; }, get: function (obj) { return obj.email; }, set: function (obj, value) { obj.email = value; } }, metadata: _metadata }, _email_initializers, _email_extraInitializers);
            __esDecorate(null, null, _telefone_decorators, { kind: "field", name: "telefone", static: false, private: false, access: { has: function (obj) { return "telefone" in obj; }, get: function (obj) { return obj.telefone; }, set: function (obj, value) { obj.telefone = value; } }, metadata: _metadata }, _telefone_initializers, _telefone_extraInitializers);
            __esDecorate(null, null, _cpf_decorators, { kind: "field", name: "cpf", static: false, private: false, access: { has: function (obj) { return "cpf" in obj; }, get: function (obj) { return obj.cpf; }, set: function (obj, value) { obj.cpf = value; } }, metadata: _metadata }, _cpf_initializers, _cpf_extraInitializers);
            __esDecorate(null, null, _endereco_decorators, { kind: "field", name: "endereco", static: false, private: false, access: { has: function (obj) { return "endereco" in obj; }, get: function (obj) { return obj.endereco; }, set: function (obj, value) { obj.endereco = value; } }, metadata: _metadata }, _endereco_initializers, _endereco_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateClienteDto = CreateClienteDto;
