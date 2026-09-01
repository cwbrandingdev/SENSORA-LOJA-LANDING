import { PerfilUsuario } from '../../usuarios/enums/perfil-usuario.enum';

// Matriz aprovada na Etapa 7: Produtos/Categorias/Clientes/Pedidos/
// ItensPedido/ImageKit são operação da loja (ADMIN + VENDEDOR); só
// Usuários fica restrito a ADMIN.
export const STAFF_ROLES: PerfilUsuario[] = [
  PerfilUsuario.ADMIN,
  PerfilUsuario.VENDEDOR,
];

export const ADMIN_ONLY_ROLES: PerfilUsuario[] = [PerfilUsuario.ADMIN];

// Etapa 2 (Minha Conta / Meus Pedidos) — libera uma rota para QUALQUER
// usuário autenticado, independente de perfil (CLIENTE incluso). Só faz
// sentido em rotas de autoatendimento onde o próprio service já filtra por
// `usuarioId` do usuário autenticado (nunca todos os registros) — nunca usar
// isto para reabrir um endpoint administrativo para CLIENTE.
export const TODOS_OS_PERFIS: PerfilUsuario[] = Object.values(PerfilUsuario);
