// Portado de frontend/components/tables/ProductTable.js — mesmo
// comportamento e colunas.
//
// Refinamento visual (Admin) — cabeçalho claro e Badge no status
// ativo/inativo e na flag de destaque, mesmo padrão de PedidoTable.tsx.
// Nenhum status novo, nenhuma coluna/ação removida.
//
// `table-fixed` com largura explícita por coluna — evita que o
// table-layout: auto padrão aloque espaço demais para colunas de conteúdo
// curto e empurre "Ações" para fora da área visível do wrapper
// `overflow-x-auto` (mesmo problema reproduzido e corrigido em
// ClientTable.tsx durante o refinamento visual).
//
// Rodada 2 (padrão ERP/SaaS, referência 21st.dev) — miniatura de
// `produto.imagemUrl` (dado já existente, só nunca exibido nesta tabela)
// como âncora visual da linha, com fallback de ícone (nunca texto inventado)
// quando não há imagem ou ela falha ao carregar — mesma estratégia de
// fallback de PlaceholderImage.tsx, só dimensionada para um avatar de
// tabela em vez de uma imagem hero. Preço ganhou formatação de moeda
// (Intl.NumberFormat, mesmo padrão de ProductCard.tsx/PedidoTable.tsx —
// antes exibia o número cru). Estoque usa lib/estoque.ts (mesma regra de
// limite já usada pela loja pública) só para colorir o número — nenhum
// limite/regra novo, e o valor exibido continua sendo `produto.quantidade`
// exato. Ações viraram ícones com tooltip (RowActions.tsx), mesmo texto
// acessível ("Editar"/"Remover") de antes.
"use client";

import { useState } from "react";
import Image from "next/image";
import { Package, Pencil, Trash2 } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import RowActions from "@/components/ui/RowActions";
import { statusEstoque, type StatusEstoque } from "@/lib/estoque";
import type { Categoria, Produto } from "@/lib/types/loja";

type ProductTableProps = {
  produtos: Produto[];
  /** GET /produtos (admin) só devolve `categoriaId`, sem a categoria
   *  aninhada (diferente de /public/produtos) — resolvemos o nome aqui no
   *  front cruzando com a lista de categorias já carregada pela página. */
  categorias: Categoria[];
  onEdit: (produto: Produto) => void;
  onRemove: (produto: Produto) => void;
};

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const ESTOQUE_TONE: Record<StatusEstoque, string> = {
  ESGOTADO: "text-red-600",
  ULTIMA_UNIDADE: "text-brand-orange",
  POUCAS_UNIDADES: "text-amber-600",
  DISPONIVEL: "text-slate-700",
};

// `key={src}` no call site remonta o componente quando a imagem muda — evita
// precisar de um useEffect só para resetar `falhou` (react-hooks/
// set-state-in-effect), mesmo problema já presente em PlaceholderImage.tsx.
function ProductThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [falhou, setFalhou] = useState(false);

  if (src && !falhou) {
    return (
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="44px"
          className="object-cover"
          onError={() => setFalhou(true)}
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-300"
    >
      <Package className="h-4 w-4" />
    </div>
  );
}

export default function ProductTable({ produtos, categorias, onEdit, onRemove }: ProductTableProps) {
  if (!produtos || produtos.length === 0) {
    return (
      <EmptyState
        compact
        eyebrow="Produtos"
        title="Nenhum produto cadastrado"
        message="Cadastre o primeiro produto para começar."
        icon={Package}
      />
    );
  }

  function nomeCategoria(produto: Produto): string | null {
    if (produto.categoria?.nome) return produto.categoria.nome;
    return categorias.find((categoria) => categoria.id === produto.categoriaId)?.nome ?? null;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full table-fixed text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th className="w-[280px] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Produto
            </th>
            <th className="hidden w-[140px] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:table-cell">
              Categoria
            </th>
            <th className="w-[110px] px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Preço
            </th>
            <th className="w-[90px] px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Estoque
            </th>
            <th className="w-[150px] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Status
            </th>
            <th className="w-[96px] px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {produtos.map((produto) => {
            const categoria = nomeCategoria(produto);
            const estoque = statusEstoque(produto.quantidade);

            return (
              <tr key={produto.id} className="transition-colors hover:bg-slate-50/70">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <ProductThumb key={produto.imagemUrl ?? "sem-imagem"} src={produto.imagemUrl} alt={produto.nome} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900" title={produto.nome}>
                        {produto.nome}
                      </p>
                      <p className="truncate text-xs text-slate-400 md:hidden">
                        {categoria ?? "Sem categoria"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-5 py-3 md:table-cell">
                  {categoria ? (
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {categoria}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Sem categoria</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">
                  {formatPrice.format(produto.preco)}
                </td>
                <td className="px-5 py-3 text-right">
                  <span className={`font-medium tabular-nums ${ESTOQUE_TONE[estoque]}`}>
                    {produto.quantidade}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={produto.ativo ? "success" : "neutral"}>
                      {produto.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    {produto.destaque && <Badge tone="info" dot={false}>Destaque</Badge>}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <RowActions
                    actions={[
                      { label: "Editar", icon: Pencil, onClick: () => onEdit(produto) },
                      {
                        label: "Remover",
                        icon: Trash2,
                        variant: "danger",
                        onClick: () => onRemove(produto),
                      },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
