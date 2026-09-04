// Etapa 6.6 (Status de Envio) — eixo logístico, deliberadamente separado de
// StatusPedido (financeiro/Asaas). MVP cobre só NAO_ENVIADO -> ENVIADO; ver
// PedidosService.marcarComoEnviado e a auditoria da Etapa 6.6.
export enum StatusEnvio {
  NAO_ENVIADO = 'NAO_ENVIADO',
  ENVIADO = 'ENVIADO',
}
