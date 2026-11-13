// Tema de Natal do site (temporário). Tudo do tema mora em components/natal/.
// Como ligar/desligar:
//   "admin" = segue o Admin: liga quando a coleção de Natal está "Ativa na
//             loja" (Admin → Coleções) e desliga quando ela é desativada.
//   true / false = força ligado/desligado pelo código, ignorando o Admin.
export const TEMA_NATAL: "admin" | boolean = "admin";

const SLUG_COLECAO_NATAL = "colecao-natal";

// Recebe as coleções ativas (as mesmas do menu) e diz se o tema está ligado.
export function temaNatalAtivo(colecoesAtivas: { slug: string }[]): boolean {
  if (TEMA_NATAL !== "admin") return TEMA_NATAL;
  return colecoesAtivas.some((colecao) => colecao.slug === SLUG_COLECAO_NATAL);
}

// Link da faixa de Natal (coleção ligada no Admin).
export const LINK_COLECAO_NATAL = `/colecoes/${SLUG_COLECAO_NATAL}`;

// Último dia de pedido para chegar antes do Natal (aviso na faixa de Natal
// da home). `null` esconde o aviso.
export const PRAZO_PEDIDOS_NATAL: string | null = "05/12";

const ID_SLIDE_NATAL = "banner-natal";

export function slidesDaHome<T extends { id: string }>(slides: T[], temaNatal: boolean): T[] {
  return temaNatal ? slides : slides.filter((slide) => slide.id !== ID_SLIDE_NATAL);
}
