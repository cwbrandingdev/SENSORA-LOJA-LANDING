// Task 10 (+ Task 21 — migração Stripe → Asaas) — mesmo padrão de
// services/enderecos.ts e services/pedidos.ts: instância `api` (axios com
// baseURL=NEXT_PUBLIC_API_URL e interceptor de Authorization: Bearer
// <token> já configurados em services/api.ts), sem nenhuma infraestrutura
// nova. Nenhuma lógica de carrinho, estoque ou criação de pedido acontece
// aqui — este service só encaminha o payload para POST /checkout/session; o
// backend é a única autoridade sobre preço, estoque e total (ver
// CheckoutService.createSession no backend). O contrato de resposta
// { sessionId, url } não mudou com a migração para o Asaas Checkout —
// `sessionId` é o id do Asaas Checkout e `url` é a página hospedada de
// pagamento, mas o frontend não precisa saber disso.
import api from "./api";
import type { CheckoutSessionResponse, CriarSessaoCheckoutPayload } from "@/lib/types/loja";

export async function criarSessaoCheckout(
  data: CriarSessaoCheckoutPayload,
): Promise<CheckoutSessionResponse> {
  const response = await api.post<CheckoutSessionResponse>("/checkout/session", data);
  return response.data;
}

// Task 11 (preservada na Task 21) — validação mínima antes de navegar para
// `sessao.url`: o backend é a fonte dessa URL, mas o frontend não deve
// executar window.location em qualquer string que chegar na resposta
// (payload malformado, resposta vazia, futura regressão no backend etc.).
// Exige URL absoluta com esquema https — cobre o caso real (Asaas Checkout
// hospedado é sempre https) sem prender a validação a um host específico,
// que poderia mudar do lado do gateway sem ser um problema de segurança.
export function isUrlDeCheckoutSegura(valor: unknown): valor is string {
  if (typeof valor !== "string" || valor.length === 0) return false;
  try {
    return new URL(valor).protocol === "https:";
  } catch {
    return false;
  }
}
