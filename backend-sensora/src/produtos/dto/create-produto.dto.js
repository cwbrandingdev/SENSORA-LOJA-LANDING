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
exports.CreateProdutoDto = void 0;
var class_validator_1 = require("class-validator");
// Etapa 10 / Task 6 (achado H12): aceita URL absoluta http(s) OU caminho
// relativo começando com "/" — mesmo padrão já validado no frontend
// (components/forms/ProductForm.tsx). Um @IsUrl() puro rejeitaria dados
// reais já existentes no banco (ex.: produtos com imagemUrl apontando para
// /images/products/... servido pelo próprio frontend, fora do ImageKit).
var IMAGEM_URL_PATTERN = /^(https?:\/\/|\/)/;
var IMAGEM_URL_MENSAGEM = 'imagemUrl deve ser uma URL http(s) válida ou um caminho relativo começando com "/"';
var CreateProdutoDto = function () {
    var _a;
    var _nome_decorators;
    var _nome_initializers = [];
    var _nome_extraInitializers = [];
    var _descricao_decorators;
    var _descricao_initializers = [];
    var _descricao_extraInitializers = [];
    var _aroma_decorators;
    var _aroma_initializers = [];
    var _aroma_extraInitializers = [];
    var _imagemUrl_decorators;
    var _imagemUrl_initializers = [];
    var _imagemUrl_extraInitializers = [];
    var _ativo_decorators;
    var _ativo_initializers = [];
    var _ativo_extraInitializers = [];
    var _destaque_decorators;
    var _destaque_initializers = [];
    var _destaque_extraInitializers = [];
    var _categoriaId_decorators;
    var _categoriaId_initializers = [];
    var _categoriaId_extraInitializers = [];
    var _preco_decorators;
    var _preco_initializers = [];
    var _preco_extraInitializers = [];
    var _quantidade_decorators;
    var _quantidade_initializers = [];
    var _quantidade_extraInitializers = [];
    return _a = /** @class */ (function () {
            function CreateProdutoDto() {
                this.nome = __runInitializers(this, _nome_initializers, void 0);
                this.descricao = (__runInitializers(this, _nome_extraInitializers), __runInitializers(this, _descricao_initializers, void 0));
                this.aroma = (__runInitializers(this, _descricao_extraInitializers), __runInitializers(this, _aroma_initializers, void 0));
                this.imagemUrl = (__runInitializers(this, _aroma_extraInitializers), __runInitializers(this, _imagemUrl_initializers, void 0));
                this.ativo = (__runInitializers(this, _imagemUrl_extraInitializers), __runInitializers(this, _ativo_initializers, void 0));
                this.destaque = (__runInitializers(this, _ativo_extraInitializers), __runInitializers(this, _destaque_initializers, void 0));
                this.categoriaId = (__runInitializers(this, _destaque_extraInitializers), __runInitializers(this, _categoriaId_initializers, void 0));
                this.preco = (__runInitializers(this, _categoriaId_extraInitializers), __runInitializers(this, _preco_initializers, void 0));
                this.quantidade = (__runInitializers(this, _preco_extraInitializers), __runInitializers(this, _quantidade_initializers, void 0));
                __runInitializers(this, _quantidade_extraInitializers);
            }
            return CreateProdutoDto;
        }()),
        (function () {
            var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _nome_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsNotEmpty)(), (0, class_validator_1.MaxLength)(150)];
            _descricao_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.MaxLength)(1000)];
            _aroma_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.MaxLength)(100)];
            _imagemUrl_decorators = [(0, class_validator_1.IsString)(), (0, class_validator_1.IsOptional)(), (0, class_validator_1.Matches)(IMAGEM_URL_PATTERN, { message: IMAGEM_URL_MENSAGEM })];
            _ativo_decorators = [(0, class_validator_1.IsBoolean)(), (0, class_validator_1.IsOptional)()];
            _destaque_decorators = [(0, class_validator_1.IsBoolean)(), (0, class_validator_1.IsOptional)()];
            _categoriaId_decorators = [(0, class_validator_1.IsInt)(), (0, class_validator_1.IsOptional)()];
            _preco_decorators = [(0, class_validator_1.IsNumber)(), (0, class_validator_1.IsPositive)()];
            _quantidade_decorators = [(0, class_validator_1.IsInt)(), (0, class_validator_1.Min)(0)];
            __esDecorate(null, null, _nome_decorators, { kind: "field", name: "nome", static: false, private: false, access: { has: function (obj) { return "nome" in obj; }, get: function (obj) { return obj.nome; }, set: function (obj, value) { obj.nome = value; } }, metadata: _metadata }, _nome_initializers, _nome_extraInitializers);
            __esDecorate(null, null, _descricao_decorators, { kind: "field", name: "descricao", static: false, private: false, access: { has: function (obj) { return "descricao" in obj; }, get: function (obj) { return obj.descricao; }, set: function (obj, value) { obj.descricao = value; } }, metadata: _metadata }, _descricao_initializers, _descricao_extraInitializers);
            __esDecorate(null, null, _aroma_decorators, { kind: "field", name: "aroma", static: false, private: false, access: { has: function (obj) { return "aroma" in obj; }, get: function (obj) { return obj.aroma; }, set: function (obj, value) { obj.aroma = value; } }, metadata: _metadata }, _aroma_initializers, _aroma_extraInitializers);
            __esDecorate(null, null, _imagemUrl_decorators, { kind: "field", name: "imagemUrl", static: false, private: false, access: { has: function (obj) { return "imagemUrl" in obj; }, get: function (obj) { return obj.imagemUrl; }, set: function (obj, value) { obj.imagemUrl = value; } }, metadata: _metadata }, _imagemUrl_initializers, _imagemUrl_extraInitializers);
            __esDecorate(null, null, _ativo_decorators, { kind: "field", name: "ativo", static: false, private: false, access: { has: function (obj) { return "ativo" in obj; }, get: function (obj) { return obj.ativo; }, set: function (obj, value) { obj.ativo = value; } }, metadata: _metadata }, _ativo_initializers, _ativo_extraInitializers);
            __esDecorate(null, null, _destaque_decorators, { kind: "field", name: "destaque", static: false, private: false, access: { has: function (obj) { return "destaque" in obj; }, get: function (obj) { return obj.destaque; }, set: function (obj, value) { obj.destaque = value; } }, metadata: _metadata }, _destaque_initializers, _destaque_extraInitializers);
            __esDecorate(null, null, _categoriaId_decorators, { kind: "field", name: "categoriaId", static: false, private: false, access: { has: function (obj) { return "categoriaId" in obj; }, get: function (obj) { return obj.categoriaId; }, set: function (obj, value) { obj.categoriaId = value; } }, metadata: _metadata }, _categoriaId_initializers, _categoriaId_extraInitializers);
            __esDecorate(null, null, _preco_decorators, { kind: "field", name: "preco", static: false, private: false, access: { has: function (obj) { return "preco" in obj; }, get: function (obj) { return obj.preco; }, set: function (obj, value) { obj.preco = value; } }, metadata: _metadata }, _preco_initializers, _preco_extraInitializers);
            __esDecorate(null, null, _quantidade_decorators, { kind: "field", name: "quantidade", static: false, private: false, access: { has: function (obj) { return "quantidade" in obj; }, get: function (obj) { return obj.quantidade; }, set: function (obj, value) { obj.quantidade = value; } }, metadata: _metadata }, _quantidade_initializers, _quantidade_extraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
}();
exports.CreateProdutoDto = CreateProdutoDto;
