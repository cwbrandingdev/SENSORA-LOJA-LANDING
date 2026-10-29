import type { ResumoAvaliacoes } from "@/lib/types/loja";
// Client da API pública do backend da Loja — mesma convenção de
// frontend/lib/api-publica.js (mesmos endpoints, mesmo formato de dados).
// Única fonte de dados comerciais: nunca criar catálogo paralelo aqui.

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Timeout nativo (sem dependência) para toda chamada a esta API — evita que
// um backend lento/travado prenda a renderização SSR indefinidamente. Tratado
// pelos mesmos caminhos de erro já existentes: em getJSON vira `null` (como
// qualquer outra falha), nas funções que lançam vira ApiPublicaIndisponivelError.
const API_TIMEOUT_MS = 8000;

export type CategoriaResumo = {
  id: number;
  nome: string;
  slug: string;
};

export type ProdutoPublico = {
  id: number;
  nome: string;
  slug: string;
  descricao?: string;
  preco: number;
  imagemUrl?: string;
  /** Galeria na ordem do Admin; a 1ª é a capa (= imagemUrl). */
  imagens?: string[];
  aroma?: string;
  destaque: boolean;
  categoriaId?: number;
  categoria?: CategoriaResumo;
  // Etapa 6.6 (aviso de estoque) — usado só como sinal de UX (ver
  // lib/estoque.ts): limitar o stepper de quantidade e mostrar avisos
  // discretos de disponibilidade. O backend segue sendo a autoridade real.
  quantidade: number;
};

export type CategoriaPublica = {
  id: number;
  nome: string;
  slug: string;
  descricao?: string;
};

// Coleção de data festiva ligada no Admin (Natal, Páscoa...).
export type ColecaoPublica = {
  id: number;
  nome: string;
  slug: string;
  titulo?: string;
  descricao?: string;
  imagemUrl?: string;
};

export type ColecaoPublicaComProdutos = ColecaoPublica & {
  produtos: ProdutoPublico[];
};

// A seção que consome isso (Produtos em Destaque) é editorial, não
// crítica: se a API estiver fora do ar ou NEXT_PUBLIC_API_URL não estiver
// configurada, a Home inteira não pode quebrar por causa disso — por isso
// falhas viram `null` aqui em vez de exceção, e quem chama trata como
// "sem dados" (a seção simplesmente não aparece).
// `tags` habilita invalidação sob demanda (ver revalidarProdutos/
// revalidarCategorias em lib/actions.ts, chamadas pelo Admin após cada
// mutação) além do teto de 60s — sem isso, uma edição no Admin só aparece
// na Loja quando o timer expirar (ver auditoria de latência Admin→Loja).
async function getJSON<T>(path: string, tags: string[]): Promise<T | null> {
  if (!API_URL) return null;

  try {
    const res = await fetch(`${API_URL}${path}`, {
      next: { revalidate: 60, tags },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!res.ok) return null;

    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function listarProdutosPublicos(): Promise<ProdutoPublico[]> {
  const produtos = await getJSON<ProdutoPublico[]>("/public/produtos", ["produtos"]);
  return produtos ?? [];
}

// Erro específico para esta busca: diferente das demais funções deste
// arquivo (que tratam qualquer falha como "sem dados", ver getJSON acima),
// a página de detalhe do produto precisa distinguir "produto não existe"
// (404 → null, vira notFound()) de "API fora do ar/rede falhou" (lança,
// quem chama decide como mostrar o erro) — ver auditoria de integração.
export class ApiPublicaIndisponivelError extends Error {
  constructor(message = "Falha ao comunicar com a API pública") {
    super(message);
    this.name = "ApiPublicaIndisponivelError";
  }
}

// Avaliações aprovadas e a média (GET /public/produtos/:slug/avaliacoes).
// Falha vira null: a página do produto só não mostra a seção.
export async function buscarAvaliacoesDoProduto(slug: string): Promise<ResumoAvaliacoes | null> {
  return getJSON<ResumoAvaliacoes>(`/public/produtos/${encodeURIComponent(slug)}/avaliacoes`, [
    "avaliacoes",
  ]);
}

export async function buscarProdutoPublicoPorSlug(slug: string): Promise<ProdutoPublico | null> {
  if (!API_URL) throw new ApiPublicaIndisponivelError();

  let res: Response;
  try {
    res = await fetch(`${API_URL}/public/produtos/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60, tags: ["produtos"] },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch {
    throw new ApiPublicaIndisponivelError();
  }

  if (res.status === 404) return null;
  if (!res.ok) throw new ApiPublicaIndisponivelError();

  try {
    return (await res.json()) as ProdutoPublico;
  } catch {
    throw new ApiPublicaIndisponivelError();
  }
}

export async function listarCategoriasPublicas(): Promise<CategoriaPublica[]> {
  const categorias = await getJSON<CategoriaPublica[]>("/public/categorias", ["categorias"]);
  return categorias ?? [];
}

// Só as ativas. Silenciosa como as de cima: API fora do ar = menu sem coleções.
export async function listarColecoesPublicas(): Promise<ColecaoPublica[]> {
  const colecoes = await getJSON<ColecaoPublica[]>("/public/colecoes", ["colecoes"]);
  return colecoes ?? [];
}

// null quando a coleção não existe ou está desligada (a página vira 404).
export async function buscarColecaoPublica(slug: string): Promise<ColecaoPublicaComProdutos | null> {
  return getJSON<ColecaoPublicaComProdutos>(`/public/colecoes/${encodeURIComponent(slug)}`, [
    "colecoes",
    "produtos",
  ]);
}

// Variantes que lançam em vez de engolir erro — isoladas de getJSON de
// propósito, para não afetar listarProdutosPublicos/listarCategoriasPublicas
// (usadas pela Home via FeaturedProducts, que precisa continuar silenciosa).
// Só para as páginas de listagem da Loja (/loja, /loja/produtos), que
// precisam diferenciar "API respondeu com catálogo vazio" de "API fora do
// ar/timeout/resposta inválida" — mesmo padrão de buscarProdutoPublicoPorSlug.
async function getJSONOuLanca<T>(path: string, tags: string[]): Promise<T> {
  if (!API_URL) throw new ApiPublicaIndisponivelError();

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      next: { revalidate: 60, tags },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch {
    throw new ApiPublicaIndisponivelError();
  }

  if (!res.ok) throw new ApiPublicaIndisponivelError();

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiPublicaIndisponivelError();
  }
}

export async function listarProdutosPublicosOuFalha(): Promise<ProdutoPublico[]> {
  return getJSONOuLanca<ProdutoPublico[]>("/public/produtos", ["produtos"]);
}

export async function listarCategoriasPublicasOuFalha(): Promise<CategoriaPublica[]> {
  return getJSONOuLanca<CategoriaPublica[]>("/public/categorias", ["categorias"]);
}

export type FaixaCupomPublica = {
  codigo: string;
  mensagem: string;
  tipoDesconto: "PERCENTUAL" | "FIXO";
  valor: number;
};

// Faixa acima do menu. Sem token: o backend devolve o cupom de visitante.
// Falha vira null — a loja abre normalmente, só sem a faixa.
export async function buscarFaixaCupomPublica(): Promise<FaixaCupomPublica | null> {
  const resposta = await getJSON<{ faixa: FaixaCupomPublica | null }>("/public/cupom-faixa", [
    "cupons",
  ]);
  return resposta?.faixa ?? null;
}
