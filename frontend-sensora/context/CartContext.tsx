"use client";

// Mesmo padrão arquitetural de context/AuthContext.tsx e ToastContext.tsx —
// createContext + Provider + hook. Carrinho é só estado local (localStorage),
// sem nenhuma chamada ao backend: a validação real de estoque continua
// acontecendo no checkout (próxima etapa), nunca aqui.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { CART_STORAGE_KEY } from "@/lib/constants";

const QUANTIDADE_MINIMA = 1;

export type CartItem = {
  produtoId: number;
  nome: string;
  slug: string;
  imagemUrl?: string;
  preco: number;
  quantidade: number;
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

function isCartItemValido(valor: unknown): valor is CartItem {
  if (!valor || typeof valor !== "object") return false;
  const item = valor as Record<string, unknown>;
  return (
    typeof item.produtoId === "number" &&
    typeof item.nome === "string" &&
    typeof item.slug === "string" &&
    typeof item.preco === "number" &&
    typeof item.quantidade === "number" &&
    (item.imagemUrl === undefined || typeof item.imagemUrl === "string")
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<CartItem[]>([]);
  const [hidratado, setHidratado] = useState(false);

  // Carrega o carrinho salvo uma única vez, no mount — cobre os três
  // cenários problemáticos: sem carrinho salvo (`raw` nulo), JSON inválido
  // (JSON.parse lança, cai no catch) e formato inesperado (itens que não
  // batem com isCartItemValido são descartados individualmente em vez de
  // derrubar o carrinho inteiro).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
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
  // que já estava salvo, antes do efeito de carga acima rodar.
  useEffect(() => {
    if (!hidratado) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(itens));
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
              ? { ...item, quantidade: item.quantidade + quantidadeNormalizada }
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
