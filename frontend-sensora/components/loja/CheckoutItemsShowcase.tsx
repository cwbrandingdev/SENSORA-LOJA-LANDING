"use client";

import { useEffect, useState } from "react";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import type { CartItem } from "@/context/CartContext";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const CAROUSEL_INTERVAL_MS = 3000;
const CROSSFADE_MS = 900;

type CheckoutItemsShowcaseProps = {
  itens: CartItem[];
  className?: string;
};

function ItemInfoCard({
  item,
  visible,
}: {
  item: CartItem;
  visible: boolean;
}) {
  return (
    <div
      className={`rounded-sm border border-white/20 bg-white/10 px-4 py-3 text-white backdrop-blur-md transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <p className="font-serif text-lg font-normal leading-snug">{item.nome}</p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span className="text-white/75">Qtd. {item.quantidade}</span>
        <span className="font-semibold tabular-nums">
          {formatPrice.format(item.preco * item.quantidade)}
        </span>
      </div>
    </div>
  );
}

export default function CheckoutItemsShowcase({
  itens,
  className = "",
}: CheckoutItemsShowcaseProps) {
  const [indice, setIndice] = useState(0);
  const [cardIndice, setCardIndice] = useState(0);
  const [cardVisible, setCardVisible] = useState(true);
  const total = itens.length;
  const item = itens[indice] ?? itens[0];
  const cardItem = itens[cardIndice] ?? itens[0];

  useEffect(() => {
    if (total <= 1) return;

    const timer = window.setInterval(() => {
      setIndice((atual) => (atual + 1) % total);
    }, CAROUSEL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [total]);

  useEffect(() => {
    if (indice === cardIndice) return;

    setCardVisible(false);
    const timer = window.setTimeout(() => {
      setCardIndice(indice);
      setCardVisible(true);
    }, CROSSFADE_MS / 2);

    return () => window.clearTimeout(timer);
  }, [indice, cardIndice]);

  if (!item || !cardItem) return null;

  return (
    <div
      className={`relative h-full overflow-hidden bg-brand-navy ${className}`}
      aria-label="Produtos selecionados"
      aria-live="polite"
    >
      <div className="absolute inset-0">
        {itens.map((entry, i) => (
          <div
            key={entry.produtoId}
            aria-hidden={i !== indice}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${
              i === indice ? "opacity-100" : "opacity-0"
            }`}
          >
            <PlaceholderImage
              src={entry.imagemUrl}
              alt={entry.nome}
              label={entry.nome}
              unoptimized={Boolean(entry.imagemUrl)}
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-black/15 to-transparent"
      />

      <div className="absolute bottom-5 left-5 right-5 z-20 flex flex-col gap-3">
        {total > 1 && (
          <div className="flex justify-center gap-2">
            {itens.map((entry, i) => (
              <button
                key={entry.produtoId}
                type="button"
                aria-label={`Ver ${entry.nome}`}
                aria-current={i === indice ? "true" : undefined}
                onClick={() => setIndice(i)}
                className={`h-1.5 rounded-full transition-all duration-500 ease-in-out ${
                  i === indice ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        )}
        <ItemInfoCard item={cardItem} visible={cardVisible} />
      </div>
    </div>
  );
}
