"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_ONLY_ROLES = exports.STAFF_ROLES = void 0;
var perfil_usuario_enum_1 = require("../../usuarios/enums/perfil-usuario.enum");
// Matriz aprovada na Etapa 7: Produtos/Categorias/Clientes/Pedidos/
// ItensPedido/ImageKit são operação da loja (ADMIN + VENDEDOR); só
// Usuários fica restrito a ADMIN.
exports.STAFF_ROLES = [
    perfil_usuario_enum_1.PerfilUsuario.ADMIN,
    perfil_usuario_enum_1.PerfilUsuario.VENDEDOR,
];
exports.ADMIN_ONLY_ROLES = [perfil_usuario_enum_1.PerfilUsuario.ADMIN];
