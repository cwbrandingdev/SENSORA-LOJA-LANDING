"use client";

// Client component isolado do resto da página de produto (Server Component)
// — só a parte interativa (estado do carrinho, quantidade, toast) precisa
// rodar no navegador. Reaproveita Button (@/components/ui/Button, agora com
// suporte a onClick) e useToast/useCart já existentes — nenhuma dependência
// nova, nenhum componente de botão paralelo.
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import QuantityStepper from "@/components/ui/QuantityStepper";
import { useCart, type ProdutoParaCarrinho } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";

const FEEDBACK_DURATION_MS = 1600;

type AddToCartControlsProps = {
  produto: ProdutoParaCarrinho;
};

export default function AddToCartControls({ produto }: AddToCartControlsProps) {
  const { adicionarItem, quantidadeNoCarrinho } = useCart();
  const toast = useToast();
  const [quantidade, setQuantidade] = useState(1);
  const [acabouDeAdicionar, setAcabouDeAdicionar] = useState(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const jaNoCarrinho = quantidadeNoCarrinho(produto.produtoId);

  function diminuir() {
    setQuantidade((atual) => Math.max(1, atual - 1));
  }

  function aumentar() {
    setQuantidade((atual) => atual + 1);
  }

  function handleAdicionar() {
    adicionarItem(produto, quantidade);

    toast.success(
      quantidade > 1
        ? `${quantidade} unidades de "${produto.nome}" adicionadas ao carrinho.`
        : `"${produto.nome}" adicionado ao carrinho.`,
    );

    setAcabouDeAdicionar(true);
    setQuantidade(1);

    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(
      () => setAcabouDeAdicionar(false),
      FEEDBACK_DURATION_MS,
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantidade} onIncrease={aumentar} onDecrease={diminuir} />

        <Button variant="primary" onClick={handleAdicionar} className="min-w-[220px]">
          {acabouDeAdicionar ? "Adicionado ✓" : "Adicionar ao carrinho"}
        </Button>
      </div>

      {jaNoCarrinho > 0 && (
        <p className="mt-3 text-[13px] text-slate-500">
          Já no carrinho:{" "}
          <span className="font-semibold text-brand-navy">
            {jaNoCarrinho} {jaNoCarrinho === 1 ? "unidade" : "unidades"}
          </span>
        </p>
      )}
    </div>
  );
}
