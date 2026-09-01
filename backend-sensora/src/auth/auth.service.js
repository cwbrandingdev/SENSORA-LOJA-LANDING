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
exports.AuthService = void 0;
var common_1 = require("@nestjs/common");
var bcrypt = require("bcrypt");
var crypto_1 = require("crypto");
var perfil_usuario_enum_1 = require("../usuarios/enums/perfil-usuario.enum");
var RESET_TOKEN_MENSAGEM = 'Se existir uma conta com esse e-mail, você receberá instruções para redefinir sua senha.';
var RESET_TOKEN_VALIDADE_MS = 60 * 60 * 1000;
var RESET_TOKEN_VALIDADE_HORAS = RESET_TOKEN_VALIDADE_MS / (60 * 60 * 1000);
var REFRESH_TOKEN_INVALIDO_MENSAGEM = 'Refresh token inválido ou expirado';
var AuthService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AuthService = _classThis = /** @class */ (function () {
        function AuthService_1(usuariosService, jwtService, configService, mailService) {
            this.usuariosService = usuariosService;
            this.jwtService = jwtService;
            this.configService = configService;
            this.mailService = mailService;
            this.logger = new common_1.Logger(AuthService.name);
        }
        AuthService_1.prototype.login = function (loginDto) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, senhaValida;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.usuariosService.buscarPorEmail(loginDto.email)];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                throw new common_1.UnauthorizedException('Credenciais inválidas');
                            }
                            return [4 /*yield*/, bcrypt.compare(loginDto.senha, usuario.senha)];
                        case 2:
                            senhaValida = _a.sent();
                            if (!senhaValida) {
                                throw new common_1.UnauthorizedException('Credenciais inválidas');
                            }
                            return [2 /*return*/, this.gerarParDeTokens(usuario.id, usuario.email, usuario.perfil)];
                    }
                });
            });
        };
        AuthService_1.prototype.register = function (registerDto) {
            return __awaiter(this, void 0, void 0, function () {
                var usuarioExistente;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.usuariosService.buscarPorEmail(registerDto.email)];
                        case 1:
                            usuarioExistente = _a.sent();
                            if (usuarioExistente) {
                                throw new common_1.ConflictException('Já existe um usuário cadastrado com este e-mail');
                            }
                            return [2 /*return*/, this.usuariosService.create({
                                    nome: registerDto.nome,
                                    email: registerDto.email,
                                    senha: registerDto.senha,
                                    perfil: perfil_usuario_enum_1.PerfilUsuario.CLIENTE,
                                    ativo: true,
                                })];
                    }
                });
            });
        };
        AuthService_1.prototype.forgotPassword = function (forgotPasswordDto) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario, resetToken, resetTokenExpiry, deveExporToken;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.usuariosService.buscarPorEmail(forgotPasswordDto.email)];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                return [2 /*return*/, { message: RESET_TOKEN_MENSAGEM }];
                            }
                            resetToken = (0, crypto_1.randomBytes)(32).toString('hex');
                            resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_VALIDADE_MS);
                            return [4 /*yield*/, this.usuariosService.salvarTokenReset(usuario.id, resetToken, resetTokenExpiry)];
                        case 2:
                            _a.sent();
                            // MailService.enviarEmail() nunca lança (falha vira log, não exceção) —
                            // o token já está persistido acima, então mesmo se o e-mail falhar
                            // (provedor indisponível, credencial ausente, timeout), a resposta ao
                            // cliente permanece a mesma de sempre (RESET_TOKEN_MENSAGEM genérica),
                            // sem revelar se o envio deu certo (Task 26).
                            return [4 /*yield*/, this.enviarEmailResetSenha(usuario, resetToken)];
                        case 3:
                            // MailService.enviarEmail() nunca lança (falha vira log, não exceção) —
                            // o token já está persistido acima, então mesmo se o e-mail falhar
                            // (provedor indisponível, credencial ausente, timeout), a resposta ao
                            // cliente permanece a mesma de sempre (RESET_TOKEN_MENSAGEM genérica),
                            // sem revelar se o envio deu certo (Task 26).
                            _a.sent();
                            deveExporToken = this.configService.get('EXPOSE_RESET_TOKEN') === 'true';
                            return [2 /*return*/, deveExporToken
                                    ? { message: RESET_TOKEN_MENSAGEM, token: resetToken }
                                    : { message: RESET_TOKEN_MENSAGEM }];
                    }
                });
            });
        };
        AuthService_1.prototype.resetPassword = function (resetPasswordDto) {
            return __awaiter(this, void 0, void 0, function () {
                var usuario;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.usuariosService.buscarPorResetToken(resetPasswordDto.token)];
                        case 1:
                            usuario = _a.sent();
                            if (!usuario) {
                                throw new common_1.UnauthorizedException('Token inválido ou expirado');
                            }
                            if (!usuario.resetTokenExpiry || usuario.resetTokenExpiry <= new Date()) {
                                throw new common_1.UnauthorizedException('Token inválido ou expirado');
                            }
                            return [4 /*yield*/, this.usuariosService.redefinirSenha(usuario.id, resetPasswordDto.novaSenha)];
                        case 2:
                            _a.sent();
                            // Achado da auditoria: sem isso, um refresh token roubado antes do reset
                            // continuaria válido depois — a troca de senha precisa encerrar todas as
                            // sessões existentes, não só bloquear login com a senha antiga.
                            return [4 /*yield*/, this.usuariosService.revogarTodosRefreshTokensAtivos(usuario.id)];
                        case 3:
                            // Achado da auditoria: sem isso, um refresh token roubado antes do reset
                            // continuaria válido depois — a troca de senha precisa encerrar todas as
                            // sessões existentes, não só bloquear login com a senha antiga.
                            _a.sent();
                            return [2 /*return*/, { message: 'Senha redefinida com sucesso.' }];
                    }
                });
            });
        };
        // Task 27. Rotação obrigatória: um refresh token só pode ser trocado por
        // um novo par de tokens uma única vez — ver revogarRefreshTokenSeAtivo()
        // em usuarios.service.ts para a garantia de atomicidade contra duas
        // requisições simultâneas com o mesmo token.
        AuthService_1.prototype.refresh = function (refreshTokenDto) {
            return __awaiter(this, void 0, void 0, function () {
                var tokenHash, registro, usuario, revogado;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            tokenHash = this.hashToken(refreshTokenDto.refresh_token);
                            return [4 /*yield*/, this.usuariosService.buscarRefreshTokenPorHash(tokenHash)];
                        case 1:
                            registro = _a.sent();
                            if (!registro ||
                                registro.revokedAt !== null ||
                                registro.expiresAt <= new Date()) {
                                throw new common_1.UnauthorizedException(REFRESH_TOKEN_INVALIDO_MENSAGEM);
                            }
                            return [4 /*yield*/, this.usuariosService.buscarAtivoPorId(registro.usuarioId)];
                        case 2:
                            usuario = _a.sent();
                            if (!usuario || !usuario.ativo) {
                                throw new common_1.UnauthorizedException(REFRESH_TOKEN_INVALIDO_MENSAGEM);
                            }
                            return [4 /*yield*/, this.usuariosService.revogarRefreshTokenSeAtivo(tokenHash)];
                        case 3:
                            revogado = _a.sent();
                            if (revogado === 0) {
                                throw new common_1.UnauthorizedException(REFRESH_TOKEN_INVALIDO_MENSAGEM);
                            }
                            return [2 /*return*/, this.gerarParDeTokens(usuario.id, usuario.email, usuario.perfil)];
                    }
                });
            });
        };
        // Idempotente por natureza: revogarRefreshTokenSeAtivo() simplesmente não
        // afeta nenhuma linha se o token já estiver revogado ou nunca tiver
        // existido — sem lançar erro nem revelar qual dos dois casos ocorreu
        // (mesmo padrão anti-enumeração de forgotPassword). O access token já
        // emitido continua válido até expirar naturalmente — não há blacklist de
        // access token nesta task.
        AuthService_1.prototype.logout = function (refreshTokenDto) {
            return __awaiter(this, void 0, void 0, function () {
                var tokenHash;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            tokenHash = this.hashToken(refreshTokenDto.refresh_token);
                            return [4 /*yield*/, this.usuariosService.revogarRefreshTokenSeAtivo(tokenHash)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, { message: 'Logout realizado com sucesso.' }];
                    }
                });
            });
        };
        // FRONTEND_URL não está no ConfigModule.validationSchema (mesmo raciocínio
        // de RESEND_API_KEY/EMAIL_FROM em mail.service.ts): opcional, e sem ela
        // não há como montar um link válido — o e-mail simplesmente não é
        // enviado, sem afetar o restante do fluxo de forgot-password.
        AuthService_1.prototype.enviarEmailResetSenha = function (usuario, resetToken) {
            return __awaiter(this, void 0, void 0, function () {
                var frontendUrl, link;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            frontendUrl = this.configService.get('FRONTEND_URL');
                            if (!frontendUrl) {
                                this.logger.warn('FRONTEND_URL não configurado — e-mail de redefinição de senha não enviado.');
                                return [2 /*return*/];
                            }
                            link = "".concat(frontendUrl, "/reset-password?token=").concat(resetToken);
                            return [4 /*yield*/, this.mailService.enviarEmail({
                                    to: usuario.email,
                                    subject: 'Redefinição de senha',
                                    html: "<p>Ol\u00E1, ".concat(usuario.nome, ".</p>") +
                                        '<p>Recebemos uma solicitação para redefinir sua senha. Clique no link abaixo para continuar:</p>' +
                                        "<p><a href=\"".concat(link, "\">").concat(link, "</a></p>") +
                                        "<p>Este link expira em ".concat(RESET_TOKEN_VALIDADE_HORAS, " hora(s).</p>") +
                                        '<p>Se você não solicitou isso, ignore este e-mail — sua senha continua a mesma.</p>',
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        // Único ponto de emissão de tokens — login() e refresh() sem duplicar a
        // lógica de assinatura do access token nem a persistência do refresh
        // token (Task 27).
        AuthService_1.prototype.gerarParDeTokens = function (usuarioId, email, perfil) {
            return __awaiter(this, void 0, void 0, function () {
                var payload, accessToken, refreshToken, refreshTokenExpiresInSegundos, expiresAt;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            payload = { sub: usuarioId, email: email, perfil: perfil };
                            accessToken = this.jwtService.sign(payload);
                            refreshToken = (0, crypto_1.randomBytes)(32).toString('hex');
                            refreshTokenExpiresInSegundos = Number(this.configService.get('REFRESH_TOKEN_EXPIRES_IN'));
                            expiresAt = new Date(Date.now() + refreshTokenExpiresInSegundos * 1000);
                            return [4 /*yield*/, this.usuariosService.criarRefreshToken(usuarioId, this.hashToken(refreshToken), expiresAt)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, { access_token: accessToken, refresh_token: refreshToken }];
                    }
                });
            });
        };
        // SHA-256 (não bcrypt): o refresh token já é 32 bytes aleatórios de alta
        // entropia — diferente de senha, não precisa de hash lento para resistir
        // a força bruta, só de não ficar em texto puro no banco.
        AuthService_1.prototype.hashToken = function (token) {
            return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
        };
        return AuthService_1;
    }());
    __setFunctionName(_classThis, "AuthService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AuthService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AuthService = _classThis;
}();
exports.AuthService = AuthService;
