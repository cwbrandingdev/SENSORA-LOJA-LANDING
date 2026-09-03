// Etapa 6.6 (aviso de estoque) — única fonte da regra de disponibilidade,
// reaproveitada por ProductCard, AddToCartControls e CartItemRow em vez de
// espalhar os mesmos números mágicos (0, 1, 5) em cada componente. O backend
// continua sendo a autoridade real (Produto.quantidade + validação atômica
// no checkout/pagamento) — tudo aqui é só sinalização de UX a partir do
// número que a API pública já expõe.
export const LIMITE_ESTOQUE_BAIXO = 5;

export type StatusEstoque =
  | "ESGOTADO"
  | "ULTIMA_UNIDADE"
  | "POUCAS_UNIDADES"
  | "DISPONIVEL";

export function statusEstoque(quantidade: number): StatusEstoque {
  if (quantidade <= 0) return "ESGOTADO";
  if (quantidade === 1) return "ULTIMA_UNIDADE";
  if (quantidade <= LIMITE_ESTOQUE_BAIXO) return "POUCAS_UNIDADES";
  return "DISPONIVEL";
}

const MENSAGENS: Record<StatusEstoque, string | null> = {
  ESGOTADO: "Esgotado",
  ULTIMA_UNIDADE: "Última unidade disponível",
  POUCAS_UNIDADES: "Restam poucas unidades",
  DISPONIVEL: null,
};

// `null` quando o estoque é normal (> LIMITE_ESTOQUE_BAIXO) — nenhum aviso
// deve aparecer nesse caso, em nenhum dos componentes.
export function mensagemEstoque(quantidade: number): string | null {
  return MENSAGENS[statusEstoque(quantidade)];
}

// Carrinho: o item já guardado pode ter uma quantidade maior do que o
// estoque conhecido mais recente (ex.: outro cliente comprou entretanto).
// Não decide nada sozinho — só informa o componente para que ele avise o
// cliente sem alterar ou remover o item automaticamente.
export function estoqueInsuficienteNoCarrinho(
  quantidadeNoCarrinho: number,
  estoqueConhecido: number | undefined,
): boolean {
  return typeof estoqueConhecido === "number" && quantidadeNoCarrinho > estoqueConhecido;
}
