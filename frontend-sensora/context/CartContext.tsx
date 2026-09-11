"use client";

// Mesmo padrão arquitetural de context/AuthContext.tsx e ToastContext.tsx —
// createContext + Provider + hook. Carrinho é só estado local (localStorage),
// sem nenhuma chamada ao backend: a validação real de estoque continua
// acontecendo no checkout (próxima etapa), nunca aqui.
//
// Etapa (Carrinho por conta) — achado da auditoria: o carrinho usava uma
// única chave fixa (CART_STORAGE_KEY) no localStorage, compartilhada por
// QUALQUER sessão no mesmo navegador — Conta B via o carrinho que a Conta A
// deixou. Corrigido resolvendo uma chave por conta (sufixo = `sub` do JWT,
// mesmo claim que AuthContext usa como userId) via getToken()/decodeToken()
// diretamente (lib/storage.ts / lib/jwt.ts) — nunca via useAuth(): o
// AuthProvider não é ancestral do CartProvider em todas as rotas que usam
// carrinho (ver app/(site)/layout.tsx, onde AuthProvider só envolve o
// Navbar, não {children}), então consumir o Context não funcionaria aqui.
//
// Por que resolver só no mount (sem listener de evento) já é suficiente:
// TODA transição de login/logout desta aplicação atravessa uma fronteira
// de root layout diferente (/login e /register são root layouts próprios,
// sem CartProvider — ver comentário equivalente em components/auth/
// AuthSwitch.tsx) — o Next.js App Router sempre faz reload completo da
// página nesse caso, então o CartProvider é desmontado e remontado do zero
// a cada login/logout real, e o efeito de hidratação abaixo já roda de
// novo lendo o token atual. Não há hoje nenhum caminho de troca de
// conta sem essa navegação entre root layouts.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { CART_STORAGE_KEY } from "@/lib/constants";
import { getToken } from "@/lib/storage";
import { decodeToken, isTokenExpired } from "@/lib/jwt";

const QUANTIDADE_MINIMA = 1;

export type CartItem = {
  produtoId: number;
  nome: string;
  slug: string;
  imagemUrl?: string;
  preco: number;
  quantidade: number;
  // Etapa 6.6 (aviso de estoque) — snapshot do Produto.quantidade da API
  // pública no momento em que o item foi adicionado/atualizado pela última
  // vez (ver adicionarItem abaixo). Só UX: permite ao carrinho avisar
  // quando a quantidade guardada ficou maior que o estoque conhecido mais
  // recente, sem nunca decidir nada por conta própria — a validação real
  // continua só no backend, no checkout. Opcional para aceitar carrinhos já
  // salvos no localStorage antes desta mudança (isCartItemValido abaixo).
  estoqueConhecido?: number;
};

// O que a UI precisa passar para adicionar um item — igual a CartItem, só
// sem `quantidade` (que é um parâmetro separado de adicionarItem, com
// default 1) para deixar explícito que a origem do dado é o produto, não
// o estado do carrinho.
export type ProdutoParaCarrinho = Omit<CartItem, "quantidade">;

type CartContextValue = {
  itens: CartItem[];
  adicionarItem: (produto: ProdutoParaCarrinho, quantidade?: number) => void;
  removerItem: (produtoId: number) => void;
  aumentarQuantidade: (produtoId: number) => void;
  diminuirQuantidade: (produtoId: number) => void;
  definirQuantidade: (produtoId: number, quantidade: number) => void;
  limparCarrinho: () => void;
  totalItens: number;
  subtotal: number;
  estaNoCarrinho: (produtoId: number) => boolean;
  quantidadeNoCarrinho: (produtoId: number) => number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

// Nunca deixa a quantidade cair abaixo de 1, nem aceita valores inválidos
// (NaN, fração, negativo) vindos de input de usuário ou de um localStorage
// corrompido — sempre normaliza para um inteiro >= QUANTIDADE_MINIMA.
function normalizarQuantidade(valor: number): number {
  if (!Number.isFinite(valor)) return QUANTIDADE_MINIMA;
  return Math.max(QUANTIDADE_MINIMA, Math.floor(valor));
}

// Etapa (Carrinho por conta) — resolve a chave de localStorage do carrinho
// ATUAL: por conta autenticada (sufixo = `sub` do JWT) quando há sessão
// válida e decodificável, ou a chave genérica de visitante
// (CART_STORAGE_KEY, comportamento inalterado para quem nunca logou) caso
// contrário. Token ausente/expirado/não decodificável cai sempre no
// visitante (mesmo raciocínio "fail safe" de isTokenExpired) — nunca
// reaproveita por engano a última conta que passou por aqui.
//
// Efeito colateral deliberado (só na primeira vez que ESTA conta loga
// neste navegador — chave da conta ainda não existe): migra o que estava
// no carrinho de visitante para a conta, e esvazia o balde de visitante.
// Preserva o comportamento já existente/testado de "adicionar ao carrinho
// sem estar logado, logar durante o checkout, carrinho continua lá" (Task
// 7) — sem isso, o requisito "não pode simplesmente limpar no login" seria
// violado para quem tinha itens como visitante. Uma conta que JÁ tem uma
// chave própria (mesmo vazia) nunca é sobrescrita por um carrinho de
// visitante avulso — só a primeira vez, nunca de novo.
function resolverChaveCarrinho(): string {
  const token = getToken();
  if (!token || isTokenExpired(token)) return CART_STORAGE_KEY;

  const sub = decodeToken(token)?.sub;
  if (typeof sub !== "number") return CART_STORAGE_KEY;

  const chaveConta = `${CART_STORAGE_KEY}_${sub}`;
  if (window.localStorage.getItem(chaveConta) === null) {
    const carrinhoVisitante = window.localStorage.getItem(CART_STORAGE_KEY);
    window.localStorage.setItem(chaveConta, carrinhoVisitante ?? "[]");
    window.localStorage.setItem(CART_STORAGE_KEY, "[]");
  }

  return chaveConta;
}

function isCartItemValido(valor: unknown): valor is CartItem {
  if (!valor || typeof valor !== "object") return false;
  const item = valor as Record<string, unknown>;
  return (
    typeof item.produtoId === "number" &&
    typeof item.nome === "string" &&
    typeof item.slug === "string" &&
    typeof item.preco === "number" &&
    typeof item.quantidade === "number" &&
    (item.imagemUrl === undefined || typeof item.imagemUrl === "string") &&
    (item.estoqueConhecido === undefined || typeof item.estoqueConhecido === "number")
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<CartItem[]>([]);
  const [hidratado, setHidratado] = useState(false);
  // Etapa (Carrinho por conta) — chave em uso pelo efeito de persistência
  // abaixo. `useRef`, não `useState`: resolvida uma única vez por mount
  // (nunca muda depois — um login/logout real sempre remonta este provider
  // do zero, ver comentário no topo do arquivo), então não precisa
  // disparar re-render nenhum, só precisa estar disponível para o efeito
  // de persistência quando `itens` mudar.
  const chaveRef = useRef(CART_STORAGE_KEY);

  // Carrega o carrinho da conta (ou de visitante) atual uma única vez, no
  // mount — cobre os três cenários problemáticos já existentes: sem
  // carrinho salvo (`raw` nulo), JSON inválido (JSON.parse lança, cai no
  // catch) e formato inesperado (itens que não batem com isCartItemValido
  // são descartados individualmente em vez de derrubar o carrinho inteiro).
  // resolverChaveCarrinho() decide POR QUAL conta (ver comentário dela) —
  // rodar de novo a cada mount (em vez de uma vez por todo o app) é o que
  // garante a chave certa depois de um login/logout real, que sempre
  // remonta este provider (ver comentário no topo do arquivo).
  useEffect(() => {
    const chave = resolverChaveCarrinho();
    chaveRef.current = chave;
    try {
      const raw = window.localStorage.getItem(chave);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItens(parsed.filter(isCartItemValido));
        }
      }
    } catch {
      // JSON inválido — segue com carrinho vazio em vez de quebrar a página.
    } finally {
      setHidratado(true);
    }
  }, []);

  // Só persiste depois de terminar de ler o localStorage — sem essa guarda,
  // o primeiro render (itens = []) salvaria um carrinho vazio por cima do
  // que já estava salvo, antes do efeito de carga acima rodar. Persiste em
  // `chaveRef.current` (não mais a constante fixa) — a mesma chave
  // resolvida (e só ela) para esta conta/visitante.
  useEffect(() => {
    if (!hidratado) return;
    try {
      window.localStorage.setItem(chaveRef.current, JSON.stringify(itens));
    } catch {
      // Storage indisponível/cheio (modo privado, quota excedida etc.) —
      // o carrinho continua funcionando em memória pelo resto da sessão.
    }
  }, [itens, hidratado]);

  const adicionarItem = useCallback(
    (produto: ProdutoParaCarrinho, quantidade: number = QUANTIDADE_MINIMA) => {
      const quantidadeNormalizada = normalizarQuantidade(quantidade);
      setItens((prev) => {
        const existente = prev.find((item) => item.produtoId === produto.produtoId);
        if (existente) {
          return prev.map((item) =>
            item.produtoId === produto.produtoId
              ? {
                  ...item,
                  quantidade: item.quantidade + quantidadeNormalizada,
                  // Refresca o snapshot de estoque conhecido com o valor
                  // que a página de origem tinha na hora deste clique —
                  // mais atual que o que já estava salvo.
                  estoqueConhecido: produto.estoqueConhecido,
                }
              : item,
          );
        }
        return [...prev, { ...produto, quantidade: quantidadeNormalizada }];
      });
    },
    [],
  );

  const removerItem = useCallback((produtoId: number) => {
    setItens((prev) => prev.filter((item) => item.produtoId !== produtoId));
  }, []);

  const aumentarQuantidade = useCallback((produtoId: number) => {
    setItens((prev) =>
      prev.map((item) =>
        item.produtoId === produtoId
          ? { ...item, quantidade: item.quantidade + 1 }
          : item,
      ),
    );
  }, []);

  const diminuirQuantidade = useCallback((produtoId: number) => {
    setItens((prev) =>
      prev.map((item) =>
        item.produtoId === produtoId
          ? { ...item, quantidade: normalizarQuantidade(item.quantidade - 1) }
          : item,
      ),
    );
  }, []);

  const definirQuantidade = useCallback((produtoId: number, quantidade: number) => {
    const quantidadeNormalizada = normalizarQuantidade(quantidade);
    setItens((prev) =>
      prev.map((item) =>
        item.produtoId === produtoId
          ? { ...item, quantidade: quantidadeNormalizada }
          : item,
      ),
    );
  }, []);

  const limparCarrinho = useCallback(() => {
    setItens([]);
  }, []);

  const estaNoCarrinho = useCallback(
    (produtoId: number) => itens.some((item) => item.produtoId === produtoId),
    [itens],
  );

  const quantidadeNoCarrinho = useCallback(
    (produtoId: number) =>
      itens.find((item) => item.produtoId === produtoId)?.quantidade ?? 0,
    [itens],
  );

  const totalItens = useMemo(
    () => itens.reduce((acc, item) => acc + item.quantidade, 0),
    [itens],
  );

  const subtotal = useMemo(
    () => itens.reduce((acc, item) => acc + item.preco * item.quantidade, 0),
    [itens],
  );

  const value: CartContextValue = {
    itens,
    adicionarItem,
    removerItem,
    aumentarQuantidade,
    diminuirQuantidade,
    definirQuantidade,
    limparCarrinho,
    totalItens,
    subtotal,
    estaNoCarrinho,
    quantidadeNoCarrinho,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart deve ser usado dentro de um CartProvider");
  }
  return context;
}
