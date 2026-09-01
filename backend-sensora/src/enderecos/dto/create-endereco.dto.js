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
exports.CreateEnderecoDto = void 0;
var class_validator_1 = require("class-validator");
var CreateEnderecoDto = function () {
    var _a;
    var _rua_decorators;
    var _rua_initializers = [];
    var _rua_extraInitializers = [];
    var _numero_decorators;
    var _numero_initializers = [];
    var _numero_extraInitializers = [];
    var _complemento_decorators;
    var _complemento_initializers = [];
    var _complemento_extraInitializers = [];
    var _bairro_decorators;
    var _bairro_initializers = [];
    var _bairro_extraInitializers = [];
    var _cidade_decorators;
    var _cidade_initializers = [];
    var _cidade_extraInitializers = [];
    var _estado_decorators;
    var _estado_initializers = [];
    var _estado_extraInitializers = [];
    var _cep_decorators;
    var _cep_initializers = [];
    var _cep_extraInitializers = [];
    var _padrao_decorators;
    var _padrao_initializers = [];
    var _padrao_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateEnderecoDto() {
                this.rua = __runInitializers(this, _rua_initializers, void 0);
                this.numero = (__runInitializers(this, _rua_extraInitializers), __runInitializers(this, _numero_initializers, void 0));
                this.complemento = (__runInitializers(this, _numero_extraInitializers), __runInitializers(this, _complemento_initializers, void 0));
                this.bairro = (__runInitializers(this, _complemento_extraInitializers), __runInitializers(this, _bairro_initializers, void 0));
                this.cidade = (__runInitializers(this, _bairro_extraInitializers), __runInitializers(this, _cidade_initializers, void 0));
                this.estado = (__runInitializers(this, _cidade_extraInitializers), __runInitializers(this, _estado_initializers, void 0));
                this.cep = (__runInitializers(this, _estado_extraInitializers), __runInitializers(this, _cep_initializers, void 0));
                this.padrao = (__runInitializers(this, _cep_extraInitializers), __runInitializers(this, _padrao_initializers, void 0));
                __runInitializers(this, _padrao_extraInitializers);
            }
            return CreateEnderecoDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _rua_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.MaxLength)(200)];
            _numero_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.MaxLength)(20)];
            _complemento_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.MaxLength)(200)];
            _bairro_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.MaxLength)(100)];
            _cidade_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.MaxLength)(100)];
            _estado_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.Length)(2, 2, { message: 'estado deve ser a sigla da UF (2 letras)' })];
            _cep_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.Matches)(/^\d{5}-?\d{3}$/, {
                    message: 'cep deve estar no formato 00000-000 ou 00000000',
                })];
            _padrao_decorators = [(0, class_validator_1.IsBoolean)(), (0, class_validator_1.IsOptional)()];
            __esDecorate(null, null, _rua_decorators, { kind: "field", name: "rua", static: false, private: false, access: { has: function (obj) { return "rua" in obj; }, get: function (obj) { return obj.rua; }, set: function (obj, value) { obj.rua = value; } }, metadata: _metadata }, _rua_initializers, _rua_extraInitializers);
            __esDecorate(null, null, _numero_decorators, { kind: "field", name: "numero", static: false, private: false, access: { has: function (obj) { return "numero" in obj; }, get: function (obj) { return obj.numero; }, set: function (obj, value) { obj.numero = value; } }, metadata: _metadata }, _numero_initializers, _numero_extraInitializers);
            __esDecorate(null, null, _complemento_decorators, { kind: "field", name: "complemento", static: false, private: false, access: { has: function (obj) { return "complemento" in obj; }, get: function (obj) { return obj.complemento; }, set: function (obj, value) { obj.complemento = value; } }, metadata: _metadata }, _complemento_initializers, _complemento_extraInitializers);
            __esDecorate(null, null, _bairro_decorators, { kind: "field", name: "bairro", static: false, private: false, access: { has: function (obj) { return "bairro" in obj; }, get: function (obj) { return obj.bairro; }, set: function (obj, value) { obj.bairro = value; } }, metadata: _metadata }, _bairro_initializers, _bairro_extraInitializers);
            __esDecorate(null, null, _cidade_decorators, { kind: "field", name: "cidade", static: false, private: false, access: { has: function (obj) { return "cidade" in obj; }, get: function (obj) { return obj.cidade; }, set: function (obj, value) { obj.cidade = value; } }, metadata: _metadata }, _cidade_initializers, _cidade_extraInitializers);
            __esDecorate(null, null, _estado_decorators, { kind: "field", name: "estado", static: false, private: false, access: { has: function (obj) { return "estado" in obj; }, get: function (obj) { return obj.estado; }, set: function (obj, value) { obj.estado = value; } }, metadata: _metadata }, _estado_initializers, _estado_extraInitializers);
            __esDecorate(null, null, _cep_decorators, { kind: "field", name: "cep", static: false, private: false, access: { has: function (obj) { return "cep" in obj; }, get: function (obj) { return obj.cep; }, set: function (obj, value) { obj.cep = value; } }, metadata: _metadata }, _cep_initializers, _cep_extraInitializers);
            __esDecorate(null, null, _padrao_decorators, { kind: "field", name: "padrao", static: false, private: false, access: { has: function (obj) { return "padrao" in obj; }, get: function (obj) { return obj.padrao; }, set: function (obj, value) { obj.padrao = value; } }, metadata: _metadata }, _padrao_initializers, _padrao_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateEnderecoDto = CreateEnderecoDto;
