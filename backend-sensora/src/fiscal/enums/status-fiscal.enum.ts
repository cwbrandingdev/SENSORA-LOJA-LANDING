// Infraestrutura Fiscal (preparação arquitetural) — espelha o enum do
// Prisma (ver schema.prisma#StatusFiscal), mesmo padrão já usado por
// StatusPedido/StatusEnvio (pedidos/enums/): o módulo de domínio expõe seu
// próprio tipo TypeScript em vez de importar o gerado pelo Prisma
// diretamente em DTOs/entities/controllers.
//
// Eixo independente de StatusPedido (financeiro) e StatusEnvio (logístico) —
// nenhum dos três influencia os outros. Ciclo de vida de PROCESSAMENTO de um
// documento, sem significado tributário: não define NF-e vs NFC-e.
export enum StatusFiscal {
  NAO_EMITIDA = 'NAO_EMITIDA',
  PROCESSANDO = 'PROCESSANDO',
  EMITIDA = 'EMITIDA',
  REJEITADA = 'REJEITADA',
  ERRO = 'ERRO',
  CANCELADA = 'CANCELADA',
}
