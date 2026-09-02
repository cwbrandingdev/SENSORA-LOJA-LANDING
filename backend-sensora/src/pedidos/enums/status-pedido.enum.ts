export enum StatusPedido {
  PENDENTE = 'PENDENTE',
  PAGO = 'PAGO',
  CANCELADO = 'CANCELADO',
  // Etapa 5B.4 — fluxo de reembolso (PAGO -> REEMBOLSO_SOLICITADO ->
  // REEMBOLSADO). Valores já existiam no enum do Prisma desde a Etapa 5B.2;
  // só agora um código (PedidosService.solicitarReembolso) transiciona um
  // Pedido para eles.
  REEMBOLSO_SOLICITADO = 'REEMBOLSO_SOLICITADO',
  REEMBOLSADO = 'REEMBOLSADO',
}
