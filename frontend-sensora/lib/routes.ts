// Portado de frontend/lib/routes.js. Rotas movidas para /admin/* nesta
// etapa de fusão (ver auditoria de fusão) — o admin agora vive dentro do
// projeto único da Landing em vez de um segundo frontend separado.
export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  // Etapa 6.4 (Confirmação de e-mail) — destino do link enviado por e-mail
  // após o cadastro (ver AuthService.enviarEmailVerificacao, backend).
  CONFIRM_EMAIL: "/confirmar-email",
  DASHBOARD: "/admin",
  PRODUTOS: "/admin/produtos",
  CATEGORIAS: "/admin/categorias",
  CLIENTES: "/admin/clientes",
  PEDIDOS: "/admin/pedidos",
  USUARIOS: "/admin/usuarios",
  // Central de Integrações (Admin) — ADMIN-only (ver Sidebar.tsx e
  // app/admin/integracoes/page.tsx), mesmo padrão de USUARIOS acima.
  INTEGRACOES: "/admin/integracoes",
  LOJA: "/loja",
  LOJA_PRODUTOS: "/loja/produtos",
  LOJA_CARRINHO: "/loja/carrinho",
  // Rota ainda não implementada (próxima etapa) — só o link do carrinho
  // aponta para cá por enquanto, ver Task 2.
  LOJA_CHECKOUT: "/loja/checkout",
  // Etapa 1 (Fundação) da área "Minha Conta" — protegida por
  // components/conta/ProtectedAccountLayout.tsx, acesso liberado para
  // qualquer usuário autenticado (não só CLIENTE).
  CONTA: "/conta",
  // Etapa 2 (Minha Conta / Meus Pedidos) — lista e detalhe (/conta/pedidos/:id,
  // montado com contaPedidoDetalhe abaixo) dos pedidos do usuário
  // autenticado. Mesma proteção herdada de /conta (ProtectedAccountLayout).
  CONTA_PEDIDOS: "/conta/pedidos",
  // Etapa 3 (Minha Conta / Dados Pessoais + Segurança) — mesma proteção
  // herdada de /conta.
  CONTA_DADOS_PESSOAIS: "/conta/dados-pessoais",
  CONTA_SEGURANCA: "/conta/seguranca",
  // Etapa 4 (Minha Conta / Endereços) — mesma proteção herdada de /conta.
  CONTA_ENDERECOS: "/conta/enderecos",
  // Task 12 (+ Task 21 — migração Stripe → Asaas) — destino de retorno do
  // Asaas Checkout após pagamento concluído (callback.successUrl). Só a
  // página de retorno visual; a confirmação real do pagamento é sempre do
  // webhook (POST /checkout/webhook, evento CHECKOUT_PAID).
  CHECKOUT_SUCESSO: "/checkout/sucesso",
  // Task 13 (+ Task 21) — destino de retorno do Asaas Checkout quando o
  // pagamento é cancelado/interrompido/expirado (callback.cancelUrl/
  // expiredUrl). Mesma natureza da rota acima: só a página de retorno
  // visual, sem nenhuma validação real de estado.
  CHECKOUT_CANCELADO: "/checkout/cancelado",
} as const;
