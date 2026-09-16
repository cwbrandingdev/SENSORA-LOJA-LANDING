// Portado de frontend/components/tables/CategoryTable.js — mesmo
// comportamento e colunas.
//
// Refinamento visual (Admin) — cabeçalho claro, mesmo padrão de
// PedidoTable.tsx/ProductTable.tsx. Nenhuma coluna/ação removida.
//
// Rodada 2 (padrão ERP/SaaS, referência 21st.dev) — célula "Nome" ganhou um
// ícone de categoria + o slug (dado já existente, só nunca exibido nesta
// tabela) como linha secundária, para não ficar visualmente vazia com só
// duas colunas de texto. Ações viraram ícones com tooltip (RowActions.tsx),
// mesmo texto acessível ("Editar"/"Remover") de antes.
//
// Refinamento visual (Admin → Categorias) — dois ajustes, mesma receita já
// usada em ProductTable.tsx: (1) slug ganhou tratamento de "identificador"
// (chip mono discreto) em vez do mesmo peso visual de texto solto, criando
// hierarquia clara nome > slug > descrição; (2) coluna "Descrição" só
// aparece a partir de `md` (`hidden md:table-cell`, igual à coluna
// "Categoria" de ProductTable.tsx) e reaparece como linha secundária dentro
// da célula "Nome" em mobile — evita que a tabela force scroll horizontal
// num telefone só para caber uma coluna que nem sempre tem conteúdo. Nenhum
// dado/coluna/ação removido, só reorganizado por breakpoint.
import { Pencil, Tag, Tags, Trash2 } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import RowActions from "@/components/ui/RowActions";
import type { Categoria } from "@/lib/types/loja";

type CategoryTableProps = {
  categorias: Categoria[];
  onEdit: (categoria: Categoria) => void;
  onRemove: (categoria: Categoria) => void;
};

export default function CategoryTable({ categorias, onEdit, onRemove }: CategoryTableProps) {
  if (!categorias || categorias.length === 0) {
    return (
      <EmptyState
        compact
        eyebrow="Categorias"
        title="Nenhuma categoria cadastrada"
        message="Cadastre a primeira categoria para organizar os produtos."
        icon={Tags}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full table-fixed text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th className="w-[220px] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:w-[280px]">
              Nome
            </th>
            <th className="hidden px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:table-cell">
              Descrição
            </th>
            <th className="w-[96px] px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {categorias.map((categoria) => (
            <tr key={categoria.id} className="transition-colors hover:bg-slate-50/70">
              <td className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy"
                  >
                    <Tag className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium text-slate-900" title={categoria.nome}>
                      {categoria.nome}
                    </p>
                    <code
                      className="inline-block max-w-full truncate rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500"
                      title={categoria.slug}
                    >
                      {categoria.slug}
                    </code>
                    {categoria.descricao && (
                      <p className="truncate text-xs text-slate-400 md:hidden" title={categoria.descricao}>
                        {categoria.descricao}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="hidden px-5 py-4 md:table-cell">
                {categoria.descricao ? (
                  <p className="truncate text-slate-500" title={categoria.descricao}>
                    {categoria.descricao}
                  </p>
                ) : (
                  <span className="italic text-slate-400">Sem descrição</span>
                )}
              </td>
              <td className="px-5 py-4">
                <RowActions
                  actions={[
                    { label: "Editar", icon: Pencil, onClick: () => onEdit(categoria) },
                    {
                      label: "Remover",
                      icon: Trash2,
                      variant: "danger",
                      onClick: () => onRemove(categoria),
                    },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
