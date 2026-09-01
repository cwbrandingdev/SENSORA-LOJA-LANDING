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
exports.ItensPedidoService = void 0;
var common_1 = require("@nestjs/common");
var perfil_usuario_enum_1 = require("../usuarios/enums/perfil-usuario.enum");
var ItensPedidoService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var ItensPedidoService = _classThis = /** @class */ (function () {
        function ItensPedidoService_1(prisma, pedidosService, produtosService) {
            this.prisma = prisma;
            this.pedidosService = pedidosService;
            this.produtosService = produtosService;
        }
        // Etapa 10 / Task 5 (achado A6): ItemPedido não tem usuarioId próprio,
        // mas pertence a um Pedido que tem — filtra pela relação `pedido` que já
        // existe no schema (ItemPedido.pedido), sem precisar de coluna nova.
        ItensPedidoService_1.prototype.findAll = function (user) {
            return __awaiter(this, void 0, void 0, function () {
                var where, itens;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = user.perfil === perfil_usuario_enum_1.PerfilUsuario.ADMIN
                                ? {}
                                : { pedido: { usuarioId: user.id } };
                            return [4 /*yield*/, this.prisma.itemPedido.findMany({ where: where })];
                        case 1:
                            itens = _a.sent();
                            return [2 /*return*/, itens.map(function (item) { return _this.paraItemPedido(item); })];
                    }
                });
            });
        };
        ItensPedidoService_1.prototype.findByPedidoId = function (pedidoId) {
            return __awaiter(this, void 0, void 0, function () {
                var itens;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.itemPedido.findMany({
                                where: { pedidoId: pedidoId },
                            })];
                        case 1:
                            itens = _a.sent();
                            return [2 /*return*/, itens.map(function (item) { return _this.paraItemPedido(item); })];
                    }
                });
            });
        };
        ItensPedidoService_1.prototype.findOne = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = this.paraItemPedido;
                            return [4 /*yield*/, this.localizar(id, user)];
                        case 1: return [2 /*return*/, _a.apply(this, [_b.sent()])];
                    }
                });
            });
        };
        ItensPedidoService_1.prototype.create = function (createItemPedidoDto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var pedidoId, produtoId, quantidade, precoUnitario, pedido, item;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            pedidoId = createItemPedidoDto.pedidoId, produtoId = createItemPedidoDto.produtoId, quantidade = createItemPedidoDto.quantidade, precoUnitario = createItemPedidoDto.precoUnitario;
                            return [4 /*yield*/, this.pedidosService.findOne(pedidoId, user)];
                        case 1:
                            pedido = _a.sent();
                            // Achado da auditoria: não é possível adicionar item a um pedido já
                            // finalizado (PAGO/CANCELADO) — checado antes de qualquer verificação/
                            // baixa de estoque.
                            this.pedidosService.garantirMutavel(pedido);
                            return [4 /*yield*/, this.produtosService.findOne(produtoId)];
                        case 2:
                            _a.sent();
                            // Achado da auditoria (race condition): o decremento é feito ANTES de
                            // criar o item, e é a própria chamada atômica (ver
                            // ProdutosService.removerEstoque) que decide se há estoque suficiente —
                            // lança BadRequestException e nada mais acontece se não houver. Isso
                            // evita criar um ItemPedido "órfão" sem estoque reservado, o que
                            // aconteceria se o item fosse criado antes do decremento.
                            return [4 /*yield*/, this.produtosService.removerEstoque(produtoId, quantidade)];
                        case 3:
                            // Achado da auditoria (race condition): o decremento é feito ANTES de
                            // criar o item, e é a própria chamada atômica (ver
                            // ProdutosService.removerEstoque) que decide se há estoque suficiente —
                            // lança BadRequestException e nada mais acontece se não houver. Isso
                            // evita criar um ItemPedido "órfão" sem estoque reservado, o que
                            // aconteceria se o item fosse criado antes do decremento.
                            _a.sent();
                            return [4 /*yield*/, this.prisma.itemPedido.create({
                                    data: {
                                        pedidoId: pedidoId,
                                        produtoId: produtoId,
                                        quantidade: quantidade,
                                        precoUnitario: precoUnitario,
                                        subtotal: quantidade * precoUnitario,
                                    },
                                })];
                        case 4:
                            item = _a.sent();
                            return [2 /*return*/, this.paraItemPedido(item)];
                    }
                });
            });
        };
        ItensPedidoService_1.prototype.update = function (id, updateItemPedidoDto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var item, pedidoAtual, pedidoDestino, produtoIdAntigo, quantidadeAntiga, novoProdutoId, novaQuantidade, diferenca, precoUnitarioFinal, atualizado;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, this.localizar(id, user)];
                        case 1:
                            item = _d.sent();
                            return [4 /*yield*/, this.pedidosService.findOne(item.pedidoId, user)];
                        case 2:
                            pedidoAtual = _d.sent();
                            this.pedidosService.garantirMutavel(pedidoAtual);
                            if (!(updateItemPedidoDto.pedidoId !== undefined)) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.pedidosService.findOne(updateItemPedidoDto.pedidoId, user)];
                        case 3:
                            pedidoDestino = _d.sent();
                            this.pedidosService.garantirMutavel(pedidoDestino);
                            _d.label = 4;
                        case 4:
                            produtoIdAntigo = item.produtoId;
                            quantidadeAntiga = item.quantidade;
                            novoProdutoId = (_a = updateItemPedidoDto.produtoId) !== null && _a !== void 0 ? _a : produtoIdAntigo;
                            novaQuantidade = (_b = updateItemPedidoDto.quantidade) !== null && _b !== void 0 ? _b : quantidadeAntiga;
                            if (!(novoProdutoId !== produtoIdAntigo)) return [3 /*break*/, 8];
                            return [4 /*yield*/, this.produtosService.findOne(novoProdutoId)];
                        case 5:
                            _d.sent();
                            return [4 /*yield*/, this.produtosService.adicionarEstoque(produtoIdAntigo, quantidadeAntiga)];
                        case 6:
                            _d.sent();
                            return [4 /*yield*/, this.produtosService.removerEstoque(novoProdutoId, novaQuantidade)];
                        case 7:
                            _d.sent();
                            return [3 /*break*/, 12];
                        case 8:
                            if (!(novaQuantidade !== quantidadeAntiga)) return [3 /*break*/, 12];
                            diferenca = novaQuantidade - quantidadeAntiga;
                            if (!(diferenca > 0)) return [3 /*break*/, 10];
                            return [4 /*yield*/, this.produtosService.removerEstoque(produtoIdAntigo, diferenca)];
                        case 9:
                            _d.sent();
                            return [3 /*break*/, 12];
                        case 10: return [4 /*yield*/, this.produtosService.adicionarEstoque(produtoIdAntigo, -diferenca)];
                        case 11:
                            _d.sent();
                            _d.label = 12;
                        case 12:
                            precoUnitarioFinal = (_c = updateItemPedidoDto.precoUnitario) !== null && _c !== void 0 ? _c : Number(item.precoUnitario);
                            return [4 /*yield*/, this.prisma.itemPedido.update({
                                    where: { id: id },
                                    data: __assign(__assign({}, updateItemPedidoDto), { subtotal: novaQuantidade * precoUnitarioFinal }),
                                })];
                        case 13:
                            atualizado = _d.sent();
                            return [2 /*return*/, this.paraItemPedido(atualizado)];
                    }
                });
            });
        };
        ItensPedidoService_1.prototype.remove = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var item, pedido;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.localizar(id, user)];
                        case 1:
                            item = _a.sent();
                            return [4 /*yield*/, this.pedidosService.findOne(item.pedidoId, user)];
                        case 2:
                            pedido = _a.sent();
                            this.pedidosService.garantirMutavel(pedido);
                            return [4 /*yield*/, this.produtosService.adicionarEstoque(item.produtoId, item.quantidade)];
                        case 3:
                            _a.sent();
                            return [4 /*yield*/, this.prisma.itemPedido.delete({ where: { id: id } })];
                        case 4:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        // Único ponto que resolve um ItemPedido por id — reforça a checagem de
        // propriedade via o pedido pai (pedidosService.findOne), então GET/PUT/
        // DELETE /itens-pedido/:id não podem ser usados para contornar o escopo
        // do VENDEDOR mesmo sabendo o id do item diretamente.
        ItensPedidoService_1.prototype.localizar = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var item;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.itemPedido.findUnique({ where: { id: id } })];
                        case 1:
                            item = _a.sent();
                            if (!item) {
                                throw new common_1.NotFoundException("Item de pedido com id ".concat(id, " n\u00E3o encontrado"));
                            }
                            return [4 /*yield*/, this.pedidosService.findOne(item.pedidoId, user)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/, item];
                    }
                });
            });
        };
        ItensPedidoService_1.prototype.paraItemPedido = function (item) {
            return {
                id: item.id,
                pedidoId: item.pedidoId,
                produtoId: item.produtoId,
                quantidade: item.quantidade,
                precoUnitario: Number(item.precoUnitario),
                subtotal: Number(item.subtotal),
            };
        };
        return ItensPedidoService_1;
    }());
    __setFunctionName(_classThis, "ItensPedidoService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ItensPedidoService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ItensPedidoService = _classThis;
}();
exports.ItensPedidoService = ItensPedidoService;
