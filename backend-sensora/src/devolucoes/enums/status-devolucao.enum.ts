// Espelho do enum StatusDevolucao do Prisma (mesmo padrão de
// pedidos/enums/status-pedido.enum.ts), para uso na API.
export enum StatusDevolucao {
  SOLICITADA = 'SOLICITADA',
  EM_ANALISE = 'EM_ANALISE',
  APROVADA = 'APROVADA',
  RECUSADA = 'RECUSADA',
  AGUARDANDO_ENVIO = 'AGUARDANDO_ENVIO',
  ENVIADA = 'ENVIADA',
  RECEBIDA = 'RECEBIDA',
  EM_CONFERENCIA = 'EM_CONFERENCIA',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA',
}
