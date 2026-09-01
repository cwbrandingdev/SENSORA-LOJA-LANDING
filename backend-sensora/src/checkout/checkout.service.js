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
exports.CheckoutService = void 0;
var common_1 = require("@nestjs/common");
var crypto = require("crypto");
var stripe_1 = require("stripe");
var status_pedido_enum_1 = require("../pedidos/enums/status-pedido.enum");
// Compara em tempo constante para não vazar, via timing, quantos caracteres
// do token recebido batem com o configurado (mesmo raciocínio de qualquer
// comparação de segredo — aqui não é HMAC como no Stripe porque o Asaas usa
// um token estático, comparado por igualdade, no header `asaas-access-token`).
function tokensIguais(recebido, esperado) {
    var bufA = Buffer.from(recebido);
    var bufB = Buffer.from(esperado);
    if (bufA.length !== bufB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}
var CheckoutService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var CheckoutService = _classThis = /** @class */ (function () {
        function CheckoutService_1(configService, prisma, produtosService, enderecosService, asaasService) {
            var _a, _b;
            this.configService = configService;
            this.prisma = prisma;
            this.produtosService = produtosService;
            this.enderecosService = enderecosService;
            this.asaasService = asaasService;
            this.gateway =
                (_a = this.configService.get('CHECKOUT_GATEWAY')) !== null && _a !== void 0 ? _a : 'asaas';
            this.frontendUrl =
                (_b = this.configService.get('FRONTEND_URL')) !== null && _b !== void 0 ? _b : 'http://localhost:3001';
            if (this.gateway === 'stripe') {
                var secretKey = this.configService.get('STRIPE_SECRET_KEY');
                if (!secretKey) {
                    throw new Error('STRIPE_SECRET_KEY não configurada');
                }
                this.stripe = new stripe_1.default(secretKey);
            }
        }
        CheckoutService_1.prototype.createSession = function (dto, usuarioId) {
            return __awaiter(this, void 0, void 0, function () {
                var total, itensPedido, itensSelecionados, _i, _a, item, produto, subtotal, numero, pedido;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            if (!dto.itens.length) {
                                throw new common_1.BadRequestException('O carrinho está vazio');
                            }
                            // Task 15 (achado da auditoria): valida que o endereço existe e pertence
                            // a este usuário (404 caso contrário) — mas o schema atual de Pedido não
                            // tem NENHUM campo de endereço (nem enderecoId, nem snapshot), então não
                            // há onde persistir qual endereço foi escolhido. Decisão registrada:
                            // manter só a validação de posse aqui, sem migração Prisma nesta task —
                            // ver relatório da Task 15 para a limitação completa.
                            return [4 /*yield*/, this.enderecosService.findOneForUsuario(dto.enderecoId, usuarioId)];
                        case 1:
                            // Task 15 (achado da auditoria): valida que o endereço existe e pertence
                            // a este usuário (404 caso contrário) — mas o schema atual de Pedido não
                            // tem NENHUM campo de endereço (nem enderecoId, nem snapshot), então não
                            // há onde persistir qual endereço foi escolhido. Decisão registrada:
                            // manter só a validação de posse aqui, sem migração Prisma nesta task —
                            // ver relatório da Task 15 para a limitação completa.
                            _b.sent();
                            total = 0;
                            itensPedido = [];
                            itensSelecionados = [];
                            _i = 0, _a = dto.itens;
                            _b.label = 2;
                        case 2:
                            if (!(_i < _a.length)) return [3 /*break*/, 5];
                            item = _a[_i];
                            return [4 /*yield*/, this.produtosService.findOne(item.produtoId)];
                        case 3:
                            produto = _b.sent();
                            // Task 16 (aprovado): findOne acha o produto mesmo se `ativo: false`
                            // (é a busca "de admin", sem filtro — ver ProdutosService), então sem
                            // esta checagem um produto desativado depois de já estar no carrinho
                            // do cliente passaria pelo checkout normalmente. Mesmo padrão de
                            // BadRequestException do erro de estoque logo abaixo.
                            if (!produto.ativo) {
                                throw new common_1.BadRequestException("Produto \"".concat(produto.nome, "\" n\u00E3o est\u00E1 mais dispon\u00EDvel"));
                            }
                            if (produto.quantidade < item.quantidade) {
                                throw new common_1.BadRequestException("Estoque insuficiente para \"".concat(produto.nome, "\""));
                            }
                            subtotal = produto.preco * item.quantidade;
                            total += subtotal;
                            itensPedido.push({
                                produtoId: produto.id,
                                quantidade: item.quantidade,
                                precoUnitario: produto.preco,
                                subtotal: subtotal,
                            });
                            itensSelecionados.push({
                                nome: produto.nome,
                                descricao: produto.descricao,
                                aroma: produto.aroma,
                                imagemUrl: produto.imagemUrl,
                                preco: produto.preco,
                                quantidade: item.quantidade,
                            });
                            _b.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5:
                            numero = "PED-".concat(Date.now());
                            return [4 /*yield*/, this.prisma.pedido.create({
                                    data: {
                                        numero: numero,
                                        data: new Date(),
                                        status: status_pedido_enum_1.StatusPedido.PENDENTE,
                                        total: total,
                                        clienteEmail: dto.clienteEmail,
                                        clienteNome: dto.clienteNome,
                                        usuarioId: usuarioId,
                                        itens: {
                                            create: itensPedido,
                                        },
                                    },
                                })];
                        case 6:
                            pedido = _b.sent();
                            return [2 /*return*/, this.gateway === 'stripe'
                                    ? this.criarSessaoStripe(dto, pedido, itensSelecionados)
                                    : this.criarSessaoAsaas(pedido, itensSelecionados)];
                    }
                });
            });
        };
        CheckoutService_1.prototype.criarSessaoStripe = function (dto, pedido, itens) {
            return __awaiter(this, void 0, void 0, function () {
                var lineItems, session;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            lineItems = itens.map(function (item) {
                                var _a, _b;
                                return ({
                                    price_data: {
                                        currency: 'brl',
                                        product_data: {
                                            name: item.nome,
                                            description: (_b = (_a = item.aroma) !== null && _a !== void 0 ? _a : item.descricao) !== null && _b !== void 0 ? _b : undefined,
                                            images: item.imagemUrl ? [item.imagemUrl] : undefined,
                                        },
                                        unit_amount: Math.round(item.preco * 100),
                                    },
                                    quantity: item.quantidade,
                                });
                            });
                            return [4 /*yield*/, this.stripe.checkout.sessions.create({
                                    mode: 'payment',
                                    customer_email: dto.clienteEmail,
                                    line_items: lineItems,
                                    success_url: "".concat(this.frontendUrl, "/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}"),
                                    cancel_url: "".concat(this.frontendUrl, "/checkout/cancelado"),
                                    metadata: {
                                        pedidoId: String(pedido.id),
                                        pedidoNumero: pedido.numero,
                                    },
                                })];
                        case 1:
                            session = _a.sent();
                            return [4 /*yield*/, this.prisma.pedido.update({
                                    where: { id: pedido.id },
                                    data: { stripeSessionId: session.id },
                                })];
                        case 2:
                            _a.sent();
                            if (!session.url) {
                                throw new common_1.BadRequestException('Não foi possível iniciar o pagamento');
                            }
                            return [2 /*return*/, { sessionId: session.id, url: session.url }];
                    }
                });
            });
        };
        // Task 21 — caminho ativo por padrão (CHECKOUT_GATEWAY="asaas"). Cria o
        // Pedido primeiro (igual ao caminho Stripe) e só então abre o Asaas
        // Checkout, usando `externalReference` para amarrar o checkout ao pedido
        // — é essa referência que o webhook usa para reconciliar o pagamento
        // (mesmo papel que `metadata.pedidoId` cumpria no lado Stripe).
        CheckoutService_1.prototype.criarSessaoAsaas = function (pedido, itens) {
            return __awaiter(this, void 0, void 0, function () {
                var checkout;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.asaasService.criarCheckout({
                                billingTypes: ['PIX', 'CREDIT_CARD'],
                                chargeTypes: ['DETACHED'],
                                items: itens.map(function (item) { return ({
                                    name: item.nome,
                                    quantity: item.quantidade,
                                    value: item.preco,
                                }); }),
                                callback: {
                                    successUrl: "".concat(this.frontendUrl, "/checkout/sucesso"),
                                    cancelUrl: "".concat(this.frontendUrl, "/checkout/cancelado"),
                                },
                                externalReference: String(pedido.id),
                            })];
                        case 1:
                            checkout = _a.sent();
                            return [4 /*yield*/, this.prisma.pedido.update({
                                    where: { id: pedido.id },
                                    data: { asaasCheckoutId: checkout.id },
                                })];
                        case 2:
                            _a.sent();
                            if (!checkout.link) {
                                throw new common_1.BadRequestException('Não foi possível iniciar o pagamento');
                            }
                            return [2 /*return*/, { sessionId: checkout.id, url: checkout.link }];
                    }
                });
            });
        };
        CheckoutService_1.prototype.getSessionStatus = function (sessionId) {
            return __awaiter(this, void 0, void 0, function () {
                var session, pedido_1, checkout, pedido;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!(this.gateway === 'stripe')) return [3 /*break*/, 3];
                            return [4 /*yield*/, this.stripe.checkout.sessions.retrieve(sessionId)];
                        case 1:
                            session = _a.sent();
                            return [4 /*yield*/, this.prisma.pedido.findUnique({
                                    where: { stripeSessionId: sessionId },
                                })];
                        case 2:
                            pedido_1 = _a.sent();
                            return [2 /*return*/, {
                                    sessionId: sessionId,
                                    status: session.payment_status,
                                    pedidoId: pedido_1 === null || pedido_1 === void 0 ? void 0 : pedido_1.id,
                                    pedidoNumero: pedido_1 === null || pedido_1 === void 0 ? void 0 : pedido_1.numero,
                                }];
                        case 3: return [4 /*yield*/, this.asaasService.consultarCheckout(sessionId)];
                        case 4:
                            checkout = _a.sent();
                            return [4 /*yield*/, this.prisma.pedido.findUnique({
                                    where: { asaasCheckoutId: sessionId },
                                })];
                        case 5:
                            pedido = _a.sent();
                            return [2 /*return*/, {
                                    sessionId: sessionId,
                                    status: checkout.status,
                                    pedidoId: pedido === null || pedido === void 0 ? void 0 : pedido.id,
                                    pedidoNumero: pedido === null || pedido === void 0 ? void 0 : pedido.numero,
                                }];
                    }
                });
            });
        };
        CheckoutService_1.prototype.handleWebhook = function (headers, rawBody) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, this.gateway === 'stripe'
                            ? this.handleWebhookStripe(headers.stripeSignature, rawBody)
                            : this.handleWebhookAsaas(headers.asaasAccessToken, rawBody)];
                });
            });
        };
        // Task 15 — único ponto de entrada do webhook do Stripe (legado, modo de
        // rollback). A assinatura (`stripe-signature` + STRIPE_WEBHOOK_SECRET) é
        // a ÚNICA coisa que prova que este payload veio mesmo do Stripe: sem uma
        // assinatura válida, o corpo da requisição não é lido como evento de
        // verdade em nenhuma circunstância — stripe.webhooks.constructEvent lança
        // se a assinatura não bater byte a byte com o rawBody recebido (payload
        // adulterado, assinatura forjada, ou assinada com o secret errado).
        CheckoutService_1.prototype.handleWebhookStripe = function (signature, rawBody) {
            return __awaiter(this, void 0, void 0, function () {
                var webhookSecret, event, session;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
                            if (!webhookSecret) {
                                throw new common_1.BadRequestException('STRIPE_WEBHOOK_SECRET não configurada');
                            }
                            try {
                                event = this.stripe.webhooks.constructEvent(rawBody, signature !== null && signature !== void 0 ? signature : '', webhookSecret);
                            }
                            catch (_b) {
                                throw new common_1.BadRequestException('Assinatura do webhook inválida');
                            }
                            if (!(event.type === 'checkout.session.completed')) return [3 /*break*/, 2];
                            session = event.data.object;
                            return [4 /*yield*/, this.confirmarPagamento({ stripeSessionId: session.id })];
                        case 1:
                            _a.sent();
                            _a.label = 2;
                        case 2: return [2 /*return*/, { received: true }];
                    }
                });
            });
        };
        // Task 21 — único ponto de entrada do webhook do Asaas. Diferente do
        // Stripe, o Asaas não assina o corpo (HMAC): ele só reenvia, em toda
        // chamada, o token configurado no painel do Asaas via o header
        // `asaas-access-token`. Comparação em tempo constante (tokensIguais)
        // contra ASAAS_WEBHOOK_TOKEN é a única coisa que prova que a chamada veio
        // do Asaas — sem ela batendo, o corpo nunca é interpretado como evento
        // real.
        CheckoutService_1.prototype.handleWebhookAsaas = function (token, rawBody) {
            return __awaiter(this, void 0, void 0, function () {
                var webhookToken, body;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            webhookToken = this.configService.get('ASAAS_WEBHOOK_TOKEN');
                            if (!webhookToken) {
                                throw new common_1.BadRequestException('ASAAS_WEBHOOK_TOKEN não configurada');
                            }
                            if (!token || !tokensIguais(token, webhookToken)) {
                                throw new common_1.BadRequestException('Token do webhook inválido');
                            }
                            try {
                                body = JSON.parse(rawBody.toString('utf8'));
                            }
                            catch (_c) {
                                throw new common_1.BadRequestException('Payload do webhook inválido');
                            }
                            if (!(body.event === 'CHECKOUT_PAID' && ((_a = body.checkout) === null || _a === void 0 ? void 0 : _a.id))) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.confirmarPagamento({ asaasCheckoutId: body.checkout.id })];
                        case 1:
                            _b.sent();
                            _b.label = 2;
                        case 2: return [2 /*return*/, { received: true }];
                    }
                });
            });
        };
        // Pagamento confirmado pelo gateway -> Pedido PENDENTE -> Pedido PAGO ->
        // baixa de estoque. NUNCA "cliente acessou /checkout/sucesso -> PAGO" —
        // essa página é só um retorno visual (Tasks 12/14), sem nenhuma ligação
        // com este método.
        CheckoutService_1.prototype.confirmarPagamento = function (where) {
            return __awaiter(this, void 0, void 0, function () {
                var pedido;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.pedido.findUnique({
                                where: where,
                                include: { itens: true },
                            })];
                        case 1:
                            pedido = _a.sent();
                            // Evento legítimo (assinatura/token já validado), mas sem pedido
                            // correspondente no nosso banco — não cria pedido, não altera estoque,
                            // só responde de forma controlada (ver handleWebhook: sempre
                            // `{ received: true }`, nunca um erro que faria o gateway reenviar algo
                            // que nunca vai encontrar pedido nenhum).
                            if (!pedido) {
                                return [2 /*return*/];
                            }
                            return [4 /*yield*/, this.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                    var resultado, _i, _a, item;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0: return [4 /*yield*/, tx.pedido.updateMany({
                                                    where: { id: pedido.id, status: status_pedido_enum_1.StatusPedido.PENDENTE },
                                                    data: { status: status_pedido_enum_1.StatusPedido.PAGO },
                                                })];
                                            case 1:
                                                resultado = _b.sent();
                                                if (resultado.count === 0) {
                                                    return [2 /*return*/];
                                                }
                                                _i = 0, _a = pedido.itens;
                                                _b.label = 2;
                                            case 2:
                                                if (!(_i < _a.length)) return [3 /*break*/, 5];
                                                item = _a[_i];
                                                return [4 /*yield*/, this.produtosService.removerEstoque(item.produtoId, item.quantidade, tx)];
                                            case 3:
                                                _b.sent();
                                                _b.label = 4;
                                            case 4:
                                                _i++;
                                                return [3 /*break*/, 2];
                                            case 5: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        return CheckoutService_1;
    }());
    __setFunctionName(_classThis, "CheckoutService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CheckoutService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CheckoutService = _classThis;
}();
exports.CheckoutService = CheckoutService;
