import { PerfilUsuario } from '../../usuarios/enums/perfil-usuario.enum';

// Matriz aprovada na Etapa 7: Produtos/Categorias/Clientes/Pedidos/
// ItensPedido/ImageKit são operação da loja (ADMIN + VENDEDOR); só
// Usuários fica restrito a ADMIN.
export const STAFF_ROLES: PerfilUsuario[] = [
  PerfilUsuario.ADMIN,
  PerfilUsuario.VENDEDOR,
];

export const ADMIN_ONLY_ROLES: PerfilUsuario[] = [PerfilUsuario.ADMIN];
