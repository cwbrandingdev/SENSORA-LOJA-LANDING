"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = void 0;
var common_1 = require("@nestjs/common");
// Lê o usuário já populado em request.user pelo JwtStrategy (Etapa 10 /
// Task 3) — não é um mecanismo de autenticação novo, só uma forma limpa de
// os controllers acessarem o que o JwtAuthGuard já validou, para as
// checagens de propriedade/escopo da Task 5 (achado A6).
exports.CurrentUser = (0, common_1.createParamDecorator)(function (_data, ctx) {
    var request = ctx
        .switchToHttp()
        .getRequest();
    return request.user;
});
