// Listas fixas do formulário "Para empresas" — o frontend mostra exatamente
// estes textos (espelho em frontend-sensora/lib/propostas-empresas.ts) e a
// API só aceita um deles.

export const CARGOS_PROPOSTA = [
  'Sócio(a) / Diretoria',
  'Gerência / Coordenação',
  'Marketing / Comunicação',
  'RH / Pessoas',
  'Compras',
  'Outro',
] as const;

export const OBJETIVOS_PROPOSTA = [
  'Presente para colaboradores',
  'Presente para clientes e parceiros',
  'Evento corporativo',
  'Ação de marca / press kit',
  'Datas comemorativas',
  'Outro',
] as const;

// Pedido mínimo: 30 unidades.
export const QUANTIDADES_PROPOSTA = [
  '30 a 99 unidades',
  '100 a 299 unidades',
  '300 a 499 unidades',
  '500 unidades ou mais',
] as const;
