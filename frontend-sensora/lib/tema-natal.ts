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

// PROVISÓRIO (enquanto o tema de Natal não está pronto): liga/desliga o
// banner de Natal no carrossel da home, independente do tema. Depois,
// apagar esta chave e o filtro em slidesDaHome: o banner volta a seguir
// só o tema (Admin).
export const BANNER_NATAL_ATIVO = true;

// Slide do carrossel da home que só existe na temporada de Natal.
const ID_SLIDE_NATAL = "banner-natal";

// Tira o banner de Natal do carrossel quando BANNER_NATAL_ATIVO é false.
// Não depende do tema: o banner pode ficar com o tema desligado.
export function slidesDaHome<T extends { id: string }>(slides: T[]): T[] {
  return BANNER_NATAL_ATIVO ? slides : slides.filter((slide) => slide.id !== ID_SLIDE_NATAL);
}