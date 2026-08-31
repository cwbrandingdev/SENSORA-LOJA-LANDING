// Linha de item somente-leitura para o resumo do checkout (Task 9) — irmã
// de CartItemRow, mas sem stepper/remover: no checkout o carrinho só é
// revisado, não editado (editar continua sendo responsabilidade da página
// /loja/carrinho). Mesma imagem/tipografia/formatação de preço do carrinho,
// nenhum padrão visual novo.
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import type { CartItem } from "@/context/CartContext";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type CheckoutItemRowProps = {
  item: CartItem;
};

export default function CheckoutItemRow({ item }: CheckoutItemRowProps) {
  return (
    <li className="flex items-center gap-4 py-5">
      <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-sm">
        <PlaceholderImage
          src={item.imagemUrl}
          alt={item.nome}
          label={item.nome}
          unoptimized={Boolean(item.imagemUrl)}
          sizes="64px"
        />
      </div>

      <div className="flex flex-1 items-start justify-between gap-3">
        {/* Task 18: min-w-0 + line-clamp-2 — mesma proteção contra nome de
            produto longo já aplicada em CartItemRow (Task 17), para que o
            resumo lateral do checkout nunca desequilibre com a imagem. */}
        <div className="min-w-0">
          <p className="line-clamp-2 font-serif text-[15px] font-normal text-brand-navy">
            {item.nome}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Qtd. {item.quantidade} · {formatPrice.format(item.preco)} un.
          </p>
        </div>

        <p className="shrink-0 text-sm font-semibold tabular-nums text-brand-navy">
          {formatPrice.format(item.preco * item.quantidade)}
        </p>
      </div>
    </li>
  );
}
