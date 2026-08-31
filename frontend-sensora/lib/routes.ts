// Portado de frontend/lib/routes.js. Rotas movidas para /admin/* nesta
// etapa de fusão (ver auditoria de fusão) — o admin agora vive dentro do
// projeto único da Landing em vez de um segundo frontend separado.
export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  DASHBOARD: "/admin",
  PRODUTOS: "/admin/produtos",
  CATEGORIAS: "/admin/categorias",
  CLIENTES: "/admin/clientes",
  PEDIDOS: "/admin/pedidos",
  USUARIOS: "/admin/usuarios",
  LOJA: "/loja",
  LOJA_PRODUTOS: "/loja/produtos",
  LOJA_CARRINHO: "/loja/carrinho",
  // Rota ainda não implementada (próxima etapa) — só o link do carrinho
  // aponta para cá por enquanto, ver Task 2.
  LOJA_CHECKOUT: "/loja/checkout",
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
