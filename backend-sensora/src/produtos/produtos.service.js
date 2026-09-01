"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProdutosService = void 0;
var common_1 = require("@nestjs/common");
var ProdutosService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ProdutosService = _classThis = /** @class */ (function () {
        function ProdutosService_1(prisma) {
            this.prisma = prisma;
        }
        ProdutosService_1.prototype.findAll = function () {
            return __awaiter(this, void 0, void 0, function () {
                var produtos;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.produto.findMany()];
                        case 1:
                            produtos = _a.sent();
                            return [2 /*return*/, produtos.map(function (produto) { return _this.paraProduto(produto); })];
                    }
                });
            });
        };
        ProdutosService_1.prototype.findOne = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var produto;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.produto.findUnique({ where: { id: id } })];
                        case 1:
                            produto = _a.sent();
                            if (!produto) {
                                throw new common_1.NotFoundException("Produto com id ".concat(id, " n\u00E3o encontrado"));
                            }
                            return [2 /*return*/, this.paraProduto(produto)];
                    }
                });
            });
        };
        ProdutosService_1.prototype.create = function (createProdutoDto) {
            return __awaiter(this, void 0, void 0, function () {
                var slug, produto;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!(createProdutoDto.categoriaId !== undefined)) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.validarCategoriaExiste(createProdutoDto.categoriaId)];
                        case 1:
                            _a.sent();
                            _a.label = 2;
                        case 2: return [4 /*yield*/, this.gerarSlugUnico(createProdutoDto.nome)];
                        case 3:
                            slug = _a.sent();
                            return [4 /*yield*/, this.prisma.produto.create({
                                    data: __assign(__assign({}, createProdutoDto), { slug: slug }),
                                })];
                        case 4:
                            produto = _a.sent();
                            return [2 /*return*/, this.paraProduto(produto)];
                    }
                });
            });
        };
        ProdutosService_1.prototype.update = function (id, updateProdutoDto) {
            return __awaiter(this, void 0, void 0, function () {
                var produto;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id)];
                        case 1:
                            _a.sent();
                            if (!(updateProdutoDto.categoriaId !== undefined)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.validarCategoriaExiste(updateProdutoDto.categoriaId)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3: return [4 /*yield*/, this.prisma.produto.update({
                                where: { id: id },
                                data: updateProdutoDto,
                            })];
                        case 4:
                            produto = _a.sent();
                            return [2 /*return*/, this.paraProduto(produto)];
                    }
                });
            });
        };
        ProdutosService_1.prototype.remove = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var itensVinculados;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id)];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.prisma.itemPedido.count({
                                    where: { produtoId: id },
                                })];
                        case 2:
                            itensVinculados = _a.sent();
                            if (itensVinculados > 0) {
                                throw new common_1.ConflictException('Não é possível excluir este produto porque ele está vinculado a pedidos existentes.');
                            }
                            return [4 /*yield*/, this.prisma.produto.delete({ where: { id: id } })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        ProdutosService_1.prototype.verificarEstoque = function (produtoId, quantidade) {
            return __awaiter(this, void 0, void 0, function () {
                var produto;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(produtoId)];
                        case 1:
                            produto = _a.sent();
                            return [2 /*return*/, produto.quantidade >= quantidade];
                    }
                });
            });
        };
        // Achado da auditoria (race condition / overselling): a checagem "tem
        // estoque suficiente?" e o decremento agora são uma única operação
        // condicional no banco (updateMany com `quantidade: { gte: quantidade }`
        // no where), em vez da sequência SELECT-depois-UPDATE anterior. Duas
        // chamadas concorrentes para o mesmo produto não conseguem mais passar
        // ambas pela checagem antes de qualquer uma escrever — a segunda sempre
        // vê o resultado já decrementado da primeira, porque o próprio Postgres
        // resolve a condição de corrida na cláusula WHERE do UPDATE.
        //
        // Task 15 (webhook Stripe): parâmetro `client` opcional — default
        // `this.prisma` preserva 100% o comportamento e as chamadas existentes.
        // Quando o chamador está dentro de um `prisma.$transaction(async (tx) =>
        // ...)` (ex.: CheckoutService confirmando pagamento + baixando estoque
        // como uma única operação atômica), passa `tx` aqui para que a baixa
        // participe da mesma transação — sem duplicar esta lógica de decremento
        // em outro lugar.
        ProdutosService_1.prototype.removerEstoque = function (produtoId_1, quantidade_1) {
            return __awaiter(this, arguments, void 0, function (produtoId, quantidade, client) {
                var resultado, produtoAtualizado;
                if (client === void 0) { client = this.prisma; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, client.produto.updateMany({
                                where: { id: produtoId, quantidade: { gte: quantidade } },
                                data: { quantidade: { decrement: quantidade } },
                            })];
                        case 1:
                            resultado = _a.sent();
                            if (!(resultado.count === 0)) return [3 /*break*/, 3];
                            // count === 0 significa "produto não existe" OU "existe mas não tem
                            // estoque suficiente" — findOne (sempre via this.prisma, nunca via
                            // `client`) só serve para escolher a exceção certa a lançar; se
                            // `client` for uma transação que ainda vai reverter, essa leitura
                            // fora dela não interfere em nenhum estado.
                            return [4 /*yield*/, this.findOne(produtoId)];
                        case 2:
                            // count === 0 significa "produto não existe" OU "existe mas não tem
                            // estoque suficiente" — findOne (sempre via this.prisma, nunca via
                            // `client`) só serve para escolher a exceção certa a lançar; se
                            // `client` for uma transação que ainda vai reverter, essa leitura
                            // fora dela não interfere em nenhum estado.
                            _a.sent();
                            throw new common_1.BadRequestException("Estoque insuficiente para o produto com id ".concat(produtoId));
                        case 3: return [4 /*yield*/, client.produto.findUnique({
                                where: { id: produtoId },
                            })];
                        case 4:
                            produtoAtualizado = _a.sent();
                            return [2 /*return*/, this.paraProduto(produtoAtualizado)];
                    }
                });
            });
        };
        ProdutosService_1.prototype.adicionarEstoque = function (produtoId, quantidade) {
            return __awaiter(this, void 0, void 0, function () {
                var atualizado;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(produtoId)];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.prisma.produto.update({
                                    where: { id: produtoId },
                                    data: { quantidade: { increment: quantidade } },
                                })];
                        case 2:
                            atualizado = _a.sent();
                            return [2 /*return*/, this.paraProduto(atualizado)];
                    }
                });
            });
        };
        ProdutosService_1.prototype.paraProduto = function (produto) {
            var _a, _b, _c, _d;
            return {
                id: produto.id,
                nome: produto.nome,
                slug: produto.slug,
                descricao: (_a = produto.descricao) !== null && _a !== void 0 ? _a : undefined,
                aroma: (_b = produto.aroma) !== null && _b !== void 0 ? _b : undefined,
                imagemUrl: (_c = produto.imagemUrl) !== null && _c !== void 0 ? _c : undefined,
                ativo: produto.ativo,
                categoriaId: (_d = produto.categoriaId) !== null && _d !== void 0 ? _d : undefined,
                preco: Number(produto.preco),
                quantidade: produto.quantidade,
                destaque: produto.destaque,
            };
        };
        ProdutosService_1.prototype.validarCategoriaExiste = function (categoriaId) {
            return __awaiter(this, void 0, void 0, function () {
                var categoria;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.categoria.findUnique({
                                where: { id: categoriaId },
                            })];
                        case 1:
                            categoria = _a.sent();
                            if (!categoria) {
                                throw new common_1.NotFoundException("Categoria com id ".concat(categoriaId, " n\u00E3o encontrada"));
                            }
                            return [2 /*return*/];
                    }
                });
            });
        };
        ProdutosService_1.prototype.gerarSlugBase = function (nome) {
            var base = nome
                .normalize('NFD')
                .replace(/\p{Diacritic}/gu, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            return base || 'produto';
        };
        ProdutosService_1.prototype.gerarSlugUnico = function (nome) {
            return __awaiter(this, void 0, void 0, function () {
                var base, slug, sufixo;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            base = this.gerarSlugBase(nome);
                            slug = base;
                            sufixo = 2;
                            _a.label = 1;
                        case 1: return [4 /*yield*/, this.prisma.produto.findUnique({ where: { slug: slug } })];
                        case 2:
                            if (!_a.sent()) return [3 /*break*/, 3];
                            slug = "".concat(base, "-").concat(sufixo);
                            sufixo += 1;
                            return [3 /*break*/, 1];
                        case 3: return [2 /*return*/, slug];
                    }
                });
            });
        };
        return ProdutosService_1;
    }());
    __setFunctionName(_classThis, "ProdutosService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ProdutosService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ProdutosService = _classThis;
}();
exports.ProdutosService = ProdutosService;
