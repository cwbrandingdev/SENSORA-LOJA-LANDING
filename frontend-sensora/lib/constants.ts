// Portado de frontend/lib/constants.js — sem mudança de comportamento.
export const TOKEN_KEY = "sensora_token";

// Chave do carrinho local (CartContext) — mesmo namespace de TOKEN_KEY.
export const CART_STORAGE_KEY = "sensora_carrinho";

// Etapa 2 (Minha Conta / limpeza do carrinho) — guarda o sessionId (Asaas
// Checkout) da última sessão de checkout criada, entre a saída para a página
// hospedada de pagamento e a volta em /checkout/sucesso. Ver lib/storage.ts
// (get/set/removeCheckoutPendente) e app/(site)/checkout/sucesso/page.tsx.
export const CHECKOUT_PENDENTE_KEY = "sensora_checkout_pendente";

// Aviso de cookies/armazenamento local — chave PRÓPRIA, deliberadamente
// separada de TOKEN_KEY: guarda só a decisão de "ciente do aviso" (ver
// lib/cookieConsent.ts), nunca a sessão/autenticação em si. Nunca reutilizar
// TOKEN_KEY para isso (limpar a sessão no logout não deve fazer o aviso
// reaparecer, e vice-versa).
export const COOKIE_CONSENT_KEY = "sensora_cookie_consent";
