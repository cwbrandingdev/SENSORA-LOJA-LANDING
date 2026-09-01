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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PedidosService = void 0;
var common_1 = require("@nestjs/common");
var perfil_usuario_enum_1 = require("../usuarios/enums/perfil-usuario.enum");
var status_pedido_enum_1 = require("./enums/status-pedido.enum");
var PedidosService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var PedidosService = _classThis = /** @class */ (function () {
        function PedidosService_1(prisma, itensPedidoService) {
            this.prisma = prisma;
            this.itensPedidoService = itensPedidoService;
        }
        // Etapa 10 / Task 5 (achado A6): ADMIN continua vendo/editando qualquer
        // pedido. VENDEDOR só enxerga pedidos cujo `usuarioId` é o dele mesmo —
        // usa a coluna que já existia no schema (antes nunca lida/escrita por
        // nenhum código) em vez de criar uma relação nova.
        PedidosService_1.prototype.podeAcessar = function (pedido, user) {
            return user.perfil === perfil_usuario_enum_1.PerfilUsuario.ADMIN || pedido.usuarioId === user.id;
        };
        // Achado da auditoria (integridade financeira): pedido PAGO ou CANCELADO é
        // tratado como imutável — nenhuma mutação (do próprio pedido ou dos itens
        // vinculados, ver ItensPedidoService) pode alterá-lo depois de finalizado.
        // Público porque ItensPedidoService também precisa desta checagem antes de
        // criar/alterar/remover um item. Só afeta mutação — leitura (findOne,
        // findAll, buscarPedidoComItens) continua liberada normalmente.
        PedidosService_1.prototype.garantirMutavel = function (pedido) {
            if (pedido.status !== status_pedido_enum_1.StatusPedido.PENDENTE) {
                throw new common_1.ConflictException("Pedido com status ".concat(pedido.status, " n\u00E3o pode ser alterado."));
            }
        };
        PedidosService_1.prototype.findAll = function (user) {
            return __awaiter(this, void 0, void 0, function () {
                var where, pedidos;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            where = user.perfil === perfil_usuario_enum_1.PerfilUsuario.ADMIN ? {} : { usuarioId: user.id };
                            return [4 /*yield*/, this.prisma.pedido.findMany({ where: where })];
                        case 1:
                            pedidos = _a.sent();
                            return [2 /*return*/, pedidos.map(function (pedido) { return _this.paraPedido(pedido); })];
                    }
                });
            });
        };
        PedidosService_1.prototype.findOne = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var pedido;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.pedido.findUnique({ where: { id: id } })];
                        case 1:
                            pedido = _a.sent();
                            // Mesma mensagem/status para "não existe" e "existe mas não é seu" —
                            // não confirma a existência de um pedido fora do escopo do VENDEDOR.
                            if (!pedido || !this.podeAcessar(pedido, user)) {
                                throw new common_1.NotFoundException("Pedido com id ".concat(id, " n\u00E3o encontrado"));
                            }
                            return [2 /*return*/, this.paraPedido(pedido)];
                    }
                });
            });
        };
        PedidosService_1.prototype.create = function (createPedidoDto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var pedido;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.pedido.create({
                                data: {
                                    numero: createPedidoDto.numero,
                                    data: new Date(createPedidoDto.data),
                                    status: (_a = createPedidoDto.status) !== null && _a !== void 0 ? _a : status_pedido_enum_1.StatusPedido.PENDENTE,
                                    total: createPedidoDto.total,
                                    // Sempre o usuário autenticado, nunca aceito do corpo da
                                    // requisição — CreatePedidoDto não tem campo `usuarioId` (o
                                    // ValidationPipe global com forbidNonWhitelisted rejeitaria/
                                    // removeria qualquer tentativa de enviá-lo), então não há como um
                                    // VENDEDOR assumir um pedido em nome de outro usuário na criação.
                                    usuarioId: user.id,
                                },
                            })];
                        case 1:
                            pedido = _b.sent();
                            return [2 /*return*/, this.paraPedido(pedido)];
                    }
                });
            });
        };
        PedidosService_1.prototype.update = function (id, updatePedidoDto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var pedidoAtual, data, rest, pedido;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id, user)];
                        case 1:
                            pedidoAtual = _a.sent();
                            this.garantirMutavel(pedidoAtual);
                            data = updatePedidoDto.data, rest = __rest(updatePedidoDto, ["data"]);
                            return [4 /*yield*/, this.prisma.pedido.update({
                                    where: { id: id },
                                    data: __assign(__assign({}, rest), (data !== undefined && { data: new Date(data) })),
                                })];
                        case 2:
                            pedido = _a.sent();
                            return [2 /*return*/, this.paraPedido(pedido)];
                    }
                });
            });
        };
        PedidosService_1.prototype.remove = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(id, user)];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.prisma.pedido.delete({ where: { id: id } })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        PedidosService_1.prototype.buscarItensDoPedido = function (pedidoId, user) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(pedidoId, user)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, this.itensPedidoService.findByPedidoId(pedidoId)];
                    }
                });
            });
        };
        PedidosService_1.prototype.calcularTotalPedido = function (pedidoId, user) {
            return __awaiter(this, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = this.somarSubtotais;
                            return [4 /*yield*/, this.buscarItensDoPedido(pedidoId, user)];
                        case 1: return [2 /*return*/, _a.apply(this, [_b.sent()])];
                    }
                });
            });
        };
        PedidosService_1.prototype.buscarPedidoComItens = function (pedidoId, user) {
            return __awaiter(this, void 0, void 0, function () {
                var pedido, itens;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.findOne(pedidoId, user)];
                        case 1:
                            pedido = _a.sent();
                            return [4 /*yield*/, this.buscarItensDoPedido(pedidoId, user)];
                        case 2:
                            itens = _a.sent();
                            return [2 /*return*/, { pedido: pedido, itens: itens, total: this.somarSubtotais(itens) }];
                    }
                });
            });
        };
        PedidosService_1.prototype.somarSubtotais = function (itens) {
            return itens.reduce(function (total, item) { return total + item.subtotal; }, 0);
        };
        PedidosService_1.prototype.paraPedido = function (pedido) {
            return {
                id: pedido.id,
                numero: pedido.numero,
                data: pedido.data,
                status: pedido.status,
                total: Number(pedido.total),
            };
        };
        return PedidosService_1;
    }());
    __setFunctionName(_classThis, "PedidosService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PedidosService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PedidosService = _classThis;
}();
exports.PedidosService = PedidosService;
