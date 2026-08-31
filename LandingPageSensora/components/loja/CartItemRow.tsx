"use client";

// Uma linha do carrinho — imagem, nome, preço unitário, stepper de
// quantidade, subtotal e remover. Usa useCart() diretamente (em vez de
// receber callbacks) porque este componente só existe dentro da árvore do
// CartProvider (montado em app/(site)/layout.tsx) — nenhuma lógica de
// estado nova, só chama o que o CartContext (Task 1) já expõe.
import Link from "next/link";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import QuantityStepper from "@/components/ui/QuantityStepper";
import { useCart, type CartItem } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type CartItemRowProps = {
  item: CartItem;
};

export default function CartItemRow({ item }: CartItemRowProps) {
  const { aumentarQuantidade, diminuirQuantidade, removerItem } = useCart();
  const toast = useToast();

  function handleRemover() {
    removerItem(item.produtoId);
    toast.success(`"${item.nome}" removido do carrinho.`);
  }

  const produtoHref = `/loja/produtos/${item.slug}`;

  return (
    // Task 17: imagem e conteúdo sempre lado a lado (nunca empilhados, nem
    // no mobile) — antes o <li> virava flex-col abaixo de sm, o que jogava
    // a imagem sozinha numa linha acima do resto; num carrinho com vários
    // itens isso consumia espaço vertical à toa e enfraquecia a leitura em
    // telas pequenas. `items-start` porque o conteúdo pode crescer mais que
    // a imagem quando o nome do produto quebra em duas linhas.
    <li className="group flex items-start gap-4 py-7 sm:gap-6">
      <Link
        href={produtoHref}
        className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 sm:w-24 lg:w-28"
      >
        <PlaceholderImage
          src={item.imagemUrl}
          alt={item.nome}
          label={item.nome}
          unoptimized={Boolean(item.imagemUrl)}
          sizes="(max-width: 639px) 80px, (max-width: 1023px) 96px, 112px"
          // Mesmo tratamento de hover sutil do ProductCard (Loja/Produtos) —
          // pointer-fine evita o "hover preso" em telas de toque.
          className="transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] pointer-fine:group-hover:scale-[1.04]"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        {/* flex-1 aqui (em vez do sm:justify-between de antes, que dividia
            a linha ~50/50 com o bloco de controles) — nomes de produto mais
            longos ganham o espaço que sobra depois do stepper/subtotal/
            remover reservarem só a largura que precisam, em vez de
            disputar metade da linha e quebrar em várias linhas
            desnecessariamente. line-clamp-2 é o limite de segurança para
            nomes realmente longos, evitando que a linha cresça sem
            controle e desequilibre a altura em relação à imagem. */}
        <div className="min-w-0 flex-1">
          <Link
            href={produtoHref}
            className="line-clamp-2 font-serif text-base font-normal text-brand-navy transition-colors hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 sm:text-lg"
          >
            {item.nome}
          </Link>
          <p className="mt-1 text-sm text-slate-500">
            {formatPrice.format(item.preco)} / unidade
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-6">
          <QuantityStepper
            value={item.quantidade}
            onIncrease={() => aumentarQuantidade(item.produtoId)}
            onDecrease={() => diminuirQuantidade(item.produtoId)}
          />

          <p className="w-20 shrink-0 text-right text-[15px] font-semibold tabular-nums text-brand-navy sm:w-24 sm:text-base">
            {formatPrice.format(item.preco * item.quantidade)}
          </p>

          {/* Mesmo tamanho/formato circular do QuantityStepper (h-11 w-11 —
              44px, alvo de toque adequado) em vez do "×" solto de antes, sem
              nenhuma área de toque real ao redor dele. */}
          <button
            type="button"
            onClick={handleRemover}
            aria-label={`Remover "${item.nome}" do carrinho`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
          >
            ×
          </button>
        </div>
      </div>
    </li>
  );
}
