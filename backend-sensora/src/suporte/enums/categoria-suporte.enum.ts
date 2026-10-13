// Espelho do enum CategoriaSuporte do Prisma, para uso na API.
export enum CategoriaSuporte {
  PRODUTO = 'PRODUTO',
  PEDIDO_ENTREGA = 'PEDIDO_ENTREGA',
  TROCA_DEVOLUCAO = 'TROCA_DEVOLUCAO',
  PAGAMENTO = 'PAGAMENTO',
  CONTA = 'CONTA',
  OUTRO = 'OUTRO',
}

// Rótulos do e-mail de aviso aos admins (frontend: ROTULOS_CATEGORIA_SUPORTE
// em lib/types/loja.ts — mantenha os dois iguais).
export const ROTULOS_CATEGORIA_SUPORTE: Record<CategoriaSuporte, string> = {
  [CategoriaSuporte.PRODUTO]: 'Dúvida sobre produto',
  [CategoriaSuporte.PEDIDO_ENTREGA]: 'Pedido e entrega',
  [CategoriaSuporte.TROCA_DEVOLUCAO]: 'Troca ou devolução',
  [CategoriaSuporte.PAGAMENTO]: 'Pagamento',
  [CategoriaSuporte.CONTA]: 'Minha conta',
  [CategoriaSuporte.OUTRO]: 'Outro assunto',
};
