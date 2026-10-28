export class CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export class CheckoutSessionStatus {
  sessionId: string;
  status: string;
  pedidoId?: number;
  pedidoNumero?: string;
}

// GET /checkout/pendente — resumo do pedido ainda PENDENTE do usuário
// autenticado (sem a URL de pagamento: essa só sai em POST /checkout/pendente,
// depois de consultar o Asaas). `null` = não há compra aguardando pagamento.
export class CheckoutPendenteResponse {
  pedidoId: number;
  pedidoNumero: string;
  total: number;
}

export class CheckoutPendenteLookupResponse {
  pendente: CheckoutPendenteResponse | null;
}
