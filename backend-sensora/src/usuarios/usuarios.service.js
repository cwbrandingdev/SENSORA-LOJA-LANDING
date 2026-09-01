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
exports.UsuariosService = void 0;
var common_1 = require("@nestjs/common");
var bcrypt = require("bcrypt");
var perfil_usuario_enum_1 = require("./enums/perfil-usuario.enum");
var SALT_ROUNDS = 10;
var UsuariosService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var UsuariosService = _classThis = /** @class */ (function () {
        function UsuariosService_1(prisma) {
            this.prisma = prisma;
        }
        UsuariosService_1.prototype.findAll = function () {
            return __awaiter(this, void 0, void 0, function () {
                var usuarios;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findMany()];
                        case 1:
                            usuarios = _a.sent();
                            return [2 /*return*/, usuarios.map(function (usuario) { return _this.paraPublico(usuario); })];
                    }
                });
            });
        };
        UsuariosService_1.prototype.findOne = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = this.paraPublico;
                            return [4 /*yield*/, this.localizar(id)];
                        case 1: return [2 /*return*/, _a.apply(this, [_b.sent()])];
                    }
                });
            });
        };
        UsuariosService_1.prototype.buscarPorEmail = function (email) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findUnique({ where: { email: email } })];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                return [2 /*return*/, null];
                            }
                            return [2 /*return*/, __assign(__assign({}, usuario), { perfil: usuario.perfil })];
                    }
                });
            });
        };
        // Usado pela JwtStrategy a cada requisição autenticada para confirmar que
        // o usuário ainda existe e segue ativo — nunca confia só no payload do
        // token. Só seleciona os campos necessários (sem `senha`).
        UsuariosService_1.prototype.buscarAtivoPorId = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findUnique({
                                where: { id: id },
                                select: { id: true, email: true, perfil: true, ativo: true },
                            })];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                return [2 /*return*/, null];
                            }
                            return [2 /*return*/, __assign(__assign({}, usuario), { perfil: usuario.perfil })];
                    }
                });
            });
        };
        UsuariosService_1.prototype.create = function (createUsuarioDto) {
            return __awaiter(this, void 0, void 0, function () {
                var senhaCriptografada, usuario;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, bcrypt.hash(createUsuarioDto.senha, SALT_ROUNDS)];
                        case 1:
                            senhaCriptografada = _b.sent();
                            return [4 /*yield*/, this.prisma.usuario.create({
                                    data: __assign(__assign({}, createUsuarioDto), { senha: senhaCriptografada, ativo: (_a = createUsuarioDto.ativo) !== null && _a !== void 0 ? _a : true }),
                                })];
                        case 2:
                            usuario = _b.sent();
                            return [2 /*return*/, this.paraPublico(usuario)];
                    }
                });
            });
        };
        UsuariosService_1.prototype.update = function (id, updateUsuarioDto) {
            return __awaiter(this, void 0, void 0, function () {
                var senha, rest, usuario, _a, _b, _c, _d;
                var _e, _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0: return [4 /*yield*/, this.localizar(id)];
                        case 1:
                            _g.sent();
                            senha = updateUsuarioDto.senha, rest = __rest(updateUsuarioDto, ["senha"]);
                            _b = (_a = this.prisma.usuario).update;
                            _e = {
                                where: { id: id }
                            };
                            _c = [__assign({}, rest)];
                            _d = senha !== undefined;
                            if (!_d) return [3 /*break*/, 3];
                            _f = {};
                            return [4 /*yield*/, bcrypt.hash(senha, SALT_ROUNDS)];
                        case 2:
                            _d = (_f.senha = _g.sent(),
                                _f);
                            _g.label = 3;
                        case 3: return [4 /*yield*/, _b.apply(_a, [(_e.data = __assign.apply(void 0, _c.concat([(_d)])),
                                    _e)])];
                        case 4:
                            usuario = _g.sent();
                            if (!(senha !== undefined)) return [3 /*break*/, 6];
                            return [4 /*yield*/, this.revogarTodosRefreshTokensAtivos(id)];
                        case 5:
                            _g.sent();
                            _g.label = 6;
                        case 6: return [2 /*return*/, this.paraPublico(usuario)];
                    }
                });
            });
        };
        // Achado da auditoria (lockout operacional): sem estas duas travas, um
        // ADMIN podia excluir a própria conta ou o único outro ADMIN restante,
        // deixando o sistema sem ninguém capaz de gerenciar usuários.
        UsuariosService_1.prototype.remove = function (id, requestingUserId) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, adminsAtivos;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.localizar(id)];
                        case 1:
                            usuario = _a.sent();
                            if (usuario.id === requestingUserId) {
                                throw new common_1.ConflictException('Não é possível excluir a própria conta.');
                            }
                            if (!(usuario.perfil === perfil_usuario_enum_1.PerfilUsuario.ADMIN &&
                                usuario.ativo)) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.prisma.usuario.count({
                                    where: { perfil: perfil_usuario_enum_1.PerfilUsuario.ADMIN, ativo: true },
                                })];
                        case 2:
                            adminsAtivos = _a.sent();
                            if (adminsAtivos <= 1) {
                                throw new common_1.ConflictException('Não é possível excluir o único administrador ativo do sistema.');
                            }
                            _a.label = 3;
                        case 3: return [4 /*yield*/, this.prisma.usuario.delete({ where: { id: id } })];
                        case 4:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        UsuariosService_1.prototype.salvarTokenReset = function (id, resetToken, resetTokenExpiry) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.update({
                                where: { id: id },
                                data: { resetToken: resetToken, resetTokenExpiry: resetTokenExpiry },
                            })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        UsuariosService_1.prototype.buscarPorResetToken = function (resetToken) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.usuario.findFirst({
                            where: { resetToken: resetToken },
                            select: { id: true, resetTokenExpiry: true },
                        })];
                });
            });
        };
        UsuariosService_1.prototype.redefinirSenha = function (id, novaSenha) {
            return __awaiter(this, void 0, void 0, function () {
                var senhaCriptografada;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, bcrypt.hash(novaSenha, SALT_ROUNDS)];
                        case 1:
                            senhaCriptografada = _a.sent();
                            return [4 /*yield*/, this.prisma.usuario.update({
                                    where: { id: id },
                                    data: {
                                        senha: senhaCriptografada,
                                        resetToken: null,
                                        resetTokenExpiry: null,
                                    },
                                })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        // Task 27 — só o hash (SHA-256, calculado em AuthService) é gravado;
        // o refresh token em texto puro nunca chega ao banco.
        UsuariosService_1.prototype.criarRefreshToken = function (usuarioId, tokenHash, expiresAt) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.refreshToken.create({
                                data: { usuarioId: usuarioId, tokenHash: tokenHash, expiresAt: expiresAt },
                            })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        UsuariosService_1.prototype.buscarRefreshTokenPorHash = function (tokenHash) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.prisma.refreshToken.findUnique({
                            where: { tokenHash: tokenHash },
                            select: { id: true, usuarioId: true, expiresAt: true, revokedAt: true },
                        })];
                });
            });
        };
        // updateMany com `revokedAt: null` na cláusula where torna a revogação
        // atômica no nível do banco: se duas requisições tentarem usar/revogar o
        // mesmo token ao mesmo tempo, só uma delas encontra a linha ainda ativa
        // (count === 1) — a outra recebe count === 0, sem precisar de uma
        // transaction explícita (Task 27, requisito de rotação segura).
        UsuariosService_1.prototype.revogarRefreshTokenSeAtivo = function (tokenHash) {
            return __awaiter(this, void 0, void 0, function () {
                var resultado;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.refreshToken.updateMany({
                                where: { tokenHash: tokenHash, revokedAt: null },
                                data: { revokedAt: new Date() },
                            })];
                        case 1:
                            resultado = _a.sent();
                            return [2 /*return*/, resultado.count];
                    }
                });
            });
        };
        // Achado da auditoria: chamado sempre que a senha de um usuário é alterada
        // (reset via /auth/reset-password ou update administrativo via
        // PUT /usuarios/:id), para que refresh tokens emitidos com a senha antiga
        // parem de funcionar. Mesmo padrão de updateMany condicional de
        // revogarRefreshTokenSeAtivo — não afeta tokens de outros usuários nem
        // tokens já revogados (where usuarioId + revokedAt: null).
        UsuariosService_1.prototype.revogarTodosRefreshTokensAtivos = function (usuarioId) {
            return __awaiter(this, void 0, void 0, function () {
                var resultado;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.refreshToken.updateMany({
                                where: { usuarioId: usuarioId, revokedAt: null },
                                data: { revokedAt: new Date() },
                            })];
                        case 1:
                            resultado = _a.sent();
                            return [2 /*return*/, resultado.count];
                    }
                });
            });
        };
        UsuariosService_1.prototype.localizar = function (id) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usuario.findUnique({ where: { id: id } })];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                throw new common_1.NotFoundException("Usu\u00E1rio com id ".concat(id, " n\u00E3o encontrado"));
                            }
                            return [2 /*return*/, usuario];
                    }
                });
            });
        };
        UsuariosService_1.prototype.paraPublico = function (usuario) {
            return {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil,
                ativo: usuario.ativo,
            };
        };
        return UsuariosService_1;
    }());
    __setFunctionName(_classThis, "UsuariosService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        UsuariosService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return UsuariosService = _classThis;
}();
exports.UsuariosService = UsuariosService;
