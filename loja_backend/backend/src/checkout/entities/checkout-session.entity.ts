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
