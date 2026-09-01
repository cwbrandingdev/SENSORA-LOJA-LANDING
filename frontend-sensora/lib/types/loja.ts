// Tipos da camada lógica da Loja, portados de frontend/services e frontend/lib
// (projeto JS original) e conferidos contra os DTOs/entities reais do
// backend (src/*/dto, src/usuarios/entities/usuario.entity.ts,
// prisma/schema.prisma) para bater exatamente com o que a API espera e
// devolve — nada aqui foi inventado.
//
// Nota sobre preço/total: os services do backend (produtos.service.ts,
// pedidos.service.ts, itens-pedido.service.ts) normalizam explicitamente
// todo campo Decimal do Prisma com Number(...) antes de devolver a
// resposta (ver paraPedido/paraProduto/paraItemPedido) — os campos
// monetários de entidade são `number` tanto nas rotas internas quanto na
// pública, batendo com as classes Produto/Pedido/ItemPedido em
// backend/src/*/entities/*.entity.ts.

export enum PerfilUsuario {
  ADMIN = "ADMIN",
  VENDEDOR = "VENDEDOR",
  CLIENTE = "CLIENTE",
}

// Espelha backend/src/common/constants/roles.constants.ts (STAFF_ROLES) —
// quem pode entrar no shell do Admin (/admin/*) no frontend. É só defesa em
// profundidade: quem decide de verdade continua sendo o RolesGuard do
// backend, esta lista nunca deve ser tratada como fonte de autorização real.
export const STAFF_ROLES: PerfilUsuario[] = [PerfilUsuario.ADMIN, PerfilUsuario.VENDEDOR];

export enum StatusPedido {
  PENDENTE = "PENDENTE",
  PAGO = "PAGO",
  CANCELADO = "CANCELADO",
}

// Resposta de GET /imagekit/auth (backend, Etapa 2) — token/expire/signature
// gerados sob demanda a cada chamada; nunca inclui a privateKey.
export type ImagekitAuthParams = {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
};

export type JwtPayload = {
  sub: number;
  email: string;
  perfil: PerfilUsuario;
  iat?: number;
  exp?: number;
};

export type AuthResponse = {
  access_token: string;
};

export type LoginPayload = {
  email: string;
  senha: string;
};

export type RegisterPayload = {
  nome: string;
  email: string;
  senha: string;
};

export type CategoriaResumo = {
  id: number;
  nome: string;
  slug: string;
};

export type Categoria = {
  id: number;
  nome: string;
  slug: string;
  descricao?: string | null;
};

export type CreateCategoriaPayload = {
  nome: string;
  descricao?: string;
};

export type UpdateCategoriaPayload = Partial<CreateCategoriaPayload>;

export type Produto = {
  id: number;
  nome: string;
  slug: string;
  descricao?: string | null;
  preco: number;
  quantidade: number;
  imagemUrl?: string | null;
  aroma?: string | null;
  ativo: boolean;
  destaque: boolean;
  categoriaId?: number | null;
  categoria?: CategoriaResumo | null;
};

export type CreateProdutoPayload = {
  nome: string;
  descricao?: string;
  aroma?: string;
  imagemUrl?: string;
  ativo?: boolean;
  destaque?: boolean;
  categoriaId?: number;
  preco: number;
  quantidade: number;
};

export type UpdateProdutoPayload = Partial<CreateProdutoPayload>;

export type Cliente = {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  endereco: string;
};

export type CreateClientePayload = {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  endereco: string;
};

export type UpdateClientePayload = Partial<CreateClientePayload>;

// Endereços de entrega do próprio usuário autenticado (Task 8 — Carrinho/
// Checkout). Espelha exatamente backend/src/enderecos/entities/
// endereco.entity.ts e create-endereco.dto.ts — usuarioId nunca é enviado
// pelo frontend, o backend sempre o extrai do token (ver services/enderecos.ts).
export type Endereco = {
  id: number;
  usuarioId: number;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  padrao: boolean;
};

export type CreateEnderecoPayload = {
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  padrao?: boolean;
};

export type Pedido = {
  id: number;
  numero: string;
  data: string;
  status: StatusPedido;
  total: number;
  // Legado (Stripe) — preservado só para pedidos antigos (Task 21).
  stripeSessionId?: string | null;
  // Id do Asaas Checkout — gateway ativo a partir da Task 21.
  asaasCheckoutId?: string | null;
  clienteEmail?: string | null;
  clienteNome?: string | null;
  usuarioId?: number | null;
};

// Payload de POST /checkout/session (Task 10) — espelha exatamente
// CreateCheckoutSessionDto (backend/src/checkout/dto/create-checkout-session.dto.ts).
// Só produtoId+quantidade por item: preço, estoque e total são recalculados
// no backend a partir do produto real (ProdutosService), nunca confiados no
// que o frontend envia — ver services/checkout.ts.
export type CheckoutItemPayload = {
  produtoId: number;
  quantidade: number;
};

export type CriarSessaoCheckoutPayload = {
  itens: CheckoutItemPayload[];
  clienteEmail: string;
  clienteNome: string;
  enderecoId: number;
};

// Espelha CheckoutSessionResponse (backend/src/checkout/entities/checkout-session.entity.ts).
// `url` é a página hospedada de pagamento (Asaas Checkout a partir da Task
// 21) — a Task 11 é quem redireciona para ela; esta task só a obtém e guarda.
export type CheckoutSessionResponse = {
  sessionId: string;
  url: string;
};

// Espelha CheckoutSessionStatus (backend/src/checkout/entities/checkout-session.entity.ts).
// Etapa 2 (Minha Conta) — usado por /checkout/sucesso para confirmar o
// status real antes de esvaziar o carrinho (ver services/checkout.ts).
// `status` reflete Pedido.status (StatusPedido: PENDENTE/PAGO/CANCELADO)
// sempre que há um pedido vinculado ao sessionId — só cai para o valor cru
// do gateway (ex.: `payment_status` do Stripe legado) no caso raro de não
// haver nenhum pedido vinculado. Tipado como `string` de propósito (não o
// enum fechado) por causa desse fallback.
export type CheckoutSessionStatus = {
  sessionId: string;
  status: string;
  pedidoId?: number;
  pedidoNumero?: string;
};

export type CreatePedidoPayload = {
  numero: string;
  data: string;
  status?: StatusPedido;
  total: number;
};

export type UpdatePedidoPayload = Partial<CreatePedidoPayload>;

export type ItemPedido = {
  id: number;
  pedidoId: number;
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
};

// Formato real de GET /pedidos/:id/itens (ver backend/src/pedidos/entities/
// pedido-com-itens.entity.ts e pedidos.service.ts#buscarPedidoComItens) —
// objeto aninhado, não achatado: { pedido, itens, total }. `total` aqui é o
// total recalculado a partir dos itens (number), distinto de `pedido.total`
// (persistido no banco, string) — a página de detalhe usa a diferença entre
// os dois para saber se precisa sincronizar o total do pedido.
export type PedidoComItens = {
  pedido: Pedido;
  itens: ItemPedido[];
  total: number;
};

// Espelha ItemPedidoDetalhado/PedidoComItensDetalhado
// (backend/src/pedidos/entities/pedido-com-itens-detalhado.entity.ts) —
// resposta de GET /pedidos/meus/:id (Etapa 2, Minha Conta). Distinto de
// ItemPedido/PedidoComItens (usados pelo Admin): aqui o item já vem com
// nome/imagem do produto, porque a tela do cliente não deve fazer um
// segundo fetch de todo o catálogo só para rotular os itens do pedido.
export type ItemPedidoDetalhado = {
  id: number;
  pedidoId: number;
  produtoId: number;
  produtoNome: string;
  produtoImagemUrl?: string | null;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
};

export type PedidoComItensDetalhado = {
  pedido: Pedido;
  itens: ItemPedidoDetalhado[];
  total: number;
};

export type CreateItemPedidoPayload = {
  pedidoId: number;
  produtoId: number;
  quantidade: number;
  precoUnitario: number;
};

export type UpdateItemPedidoPayload = Partial<CreateItemPedidoPayload>;

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
};

export type CreateUsuarioPayload = {
  nome: string;
  email: string;
  senha: string;
  perfil: PerfilUsuario;
  ativo?: boolean;
};

export type UpdateUsuarioPayload = Partial<CreateUsuarioPayload>;
