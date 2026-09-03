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
import { mensagemEstoque } from "@/lib/estoque";

const FEEDBACK_DURATION_MS = 1600;

type AddToCartControlsProps = {
  produto: ProdutoParaCarrinho;
};

export default function AddToCartControls({ produto }: AddToCartControlsProps) {
  const { adicionarItem, quantidadeNoCarrinho } = useCart();
  const toast = useToast();
  // Etapa 6.6 — quantidade inicial nunca acima do limite conhecido: com
  // estoque esgotado (0), começa em 0 (controles desabilitados logo abaixo)
  // em vez do 1 anterior, que já seria uma quantidade maior que o estoque.
  const [quantidade, setQuantidade] = useState(() => (produto.estoqueConhecido === 0 ? 0 : 1));
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

  // Etapa 6.6 — estoque conhecido pelo frontend, só para UX (ver
  // lib/estoque.ts): limita o stepper e desabilita a compra quando esgotado.
  // undefined (não deveria acontecer nas chamadas atuais, mas o tipo é
  // opcional para aceitar carrinhos antigos) é tratado como "sem limite
  // conhecido", preservando o comportamento anterior em vez de bloquear a
  // compra por falta de dado.
  const estoqueConhecido = produto.estoqueConhecido;
  const semEstoque = estoqueConhecido === 0;
  const avisoEstoque =
    typeof estoqueConhecido === "number" ? mensagemEstoque(estoqueConhecido) : null;

  function diminuir() {
    setQuantidade((atual) => Math.max(1, atual - 1));
  }

  function aumentar() {
    setQuantidade((atual) =>
      typeof estoqueConhecido === "number" ? Math.min(estoqueConhecido, atual + 1) : atual + 1,
    );
  }

  function handleAdicionar() {
    if (semEstoque) return;
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
        <QuantityStepper
          value={quantidade}
          onIncrease={aumentar}
          onDecrease={diminuir}
          max={estoqueConhecido}
          disabled={semEstoque}
        />

        <Button
          variant="primary"
          onClick={handleAdicionar}
          disabled={semEstoque}
          className="min-w-[220px]"
        >
          {semEstoque ? "Esgotado" : acabouDeAdicionar ? "Adicionado ✓" : "Adicionar ao carrinho"}
        </Button>
      </div>

      {avisoEstoque && !semEstoque && (
        <p className="mt-3 text-[13px] font-medium text-brand-orange">{avisoEstoque}</p>
      )}

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
