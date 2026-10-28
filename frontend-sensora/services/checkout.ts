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
import { setCheckoutPendente } from "@/lib/storage";
import type {
  CheckoutPendente,
  CheckoutPendenteLookup,
  CheckoutSessionResponse,
  CheckoutSessionStatus,
  CriarSessaoCheckoutPayload,
} from "@/lib/types/loja";

export async function criarSessaoCheckout(
  data: CriarSessaoCheckoutPayload,
): Promise<CheckoutSessionResponse> {
  const response = await api.post<CheckoutSessionResponse>("/checkout/session", data);
  return response.data;
}

// Etapa 2 (Minha Conta / limpeza do carrinho) — GET /checkout/session/:sessionId
// (endpoint já existente, ver checkout.controller.ts). Usado por
// /checkout/sucesso para confirmar o status real da sessão antes de esvaziar
// o carrinho, em vez de assumir sucesso só pelo fato de ter chegado nessa
// página (o Asaas Checkout redireciona no navegador, sem garantia
// criptográfica igual ao webhook — ver comentário em
// app/(site)/checkout/sucesso/page.tsx).
export async function buscarStatusSessao(
  sessionId: string,
): Promise<CheckoutSessionStatus> {
  const response = await api.get<CheckoutSessionStatus>(
    `/checkout/session/${encodeURIComponent(sessionId)}`,
  );
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

// GET /checkout/pendente — só o banco, sem falar com o Asaas. Falha de
// rede/401 nunca deve quebrar o carrinho: o banner simplesmente não aparece.
export async function buscarCheckoutPendente(): Promise<CheckoutPendente | null> {
  try {
    const response = await api.get<CheckoutPendenteLookup>("/checkout/pendente");
    return response.data?.pendente ?? null;
  } catch {
    return null;
  }
}

// POST /checkout/pendente — reabre o Asaas Checkout do Pedido já criado
// (ou gera um checkout novo para o MESMO pedido se o Asaas cancelou o
// anterior ainda dentro do prazo). Fora do TTL o backend recusa.
export async function retomarCheckoutPendente(
  pedidoId?: number,
): Promise<CheckoutSessionResponse> {
  const response = await api.post<CheckoutSessionResponse>(
    "/checkout/pendente",
    pedidoId !== undefined ? { pedidoId } : {},
  );
  return response.data;
}

// Mesmo redirecionamento de POST /checkout/session: valida a URL, grava o
// sessionId para /checkout/sucesso e sai para a página hospedada do Asaas.
export function redirecionarParaPagamento(sessao: CheckoutSessionResponse): boolean {
  if (!isUrlDeCheckoutSegura(sessao.url)) return false;
  setCheckoutPendente(sessao.sessionId);
  window.location.assign(sessao.url);
  return true;
}
