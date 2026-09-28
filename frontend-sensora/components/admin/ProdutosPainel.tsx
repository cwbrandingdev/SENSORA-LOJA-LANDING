"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Package, PackageX, Search, Star, X } from "lucide-react";
import ProductTable from "@/components/tables/ProductTable";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/InlineErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { LIMITE_ESTOQUE_BAIXO } from "@/lib/estoque";
import type { Categoria, Produto } from "@/lib/types/loja";

// Lista de produtos do Admin: números de resumo, busca/filtros (só no
// navegador, sem chamada nova à API) e uma tabela única. O formulário de
// criar/editar abre num painel lateral à direita. Toda a lógica
// (carregar/criar/editar/remover/revalidar a loja) continua na página.

type FiltroSituacao = "todos" | "inativos" | "destaque" | "estoque-baixo" | "esgotados";

const SITUACOES: { id: FiltroSituacao; label: string }[] = [
  { id: "destaque", label: "Em destaque" },
  { id: "estoque-baixo", label: "Estoque baixo" },
  { id: "esgotados", label: "Esgotados" },
  { id: "inativos", label: "Inativos" },
];

type Props = {
  produtos: Produto[];
  categorias: Categoria[];
  loading: boolean;
  erro: string | null;
  onRetry: () => void;
  onEdit: (produto: Produto) => void;
  onRemove: (produto: Produto) => void;
  /** Formulário de criar/editar já montado pela página (ou null se fechado). */
  formulario: ReactNode | null;
  onFecharFormulario: () => void;
};

function estoqueBaixo(produto: Produto): boolean {
  return produto.quantidade > 0 && produto.quantidade <= LIMITE_ESTOQUE_BAIXO;
}

function Resumo({ produtos }: { produtos: Produto[] }) {
  const itens = [
    { rotulo: "Produtos", valor: produtos.length, icone: Package, tom: "text-brand-navy bg-brand-navy/5" },
    { rotulo: "Em destaque", valor: produtos.filter((p) => p.destaque).length, icone: Star, tom: "text-sky-700 bg-sky-50" },
    { rotulo: "Estoque baixo", valor: produtos.filter(estoqueBaixo).length, icone: AlertTriangle, tom: "text-amber-700 bg-amber-50" },
    { rotulo: "Esgotados", valor: produtos.filter((p) => p.quantidade <= 0).length, icone: PackageX, tom: "text-red-700 bg-red-50" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map(({ rotulo, valor, icone: Icone, tom }) => (
        <div key={rotulo} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tom}`}>
            <Icone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{valor}</p>
            <p className="truncate text-xs text-slate-500">{rotulo}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListaFiltrada({ produtos, categorias, onEdit, onRemove }: Pick<Props, "produtos" | "categorias" | "onEdit" | "onRemove">) {
  const [busca, setBusca] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | "todas">("todas");
  const [situacao, setSituacao] = useState<FiltroSituacao>("todos");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (termo && !p.nome.toLowerCase().includes(termo)) return false;
      if (categoriaId !== "todas" && p.categoriaId !== categoriaId) return false;
      if (situacao === "inativos" && p.ativo) return false;
      if (situacao === "destaque" && !p.destaque) return false;
      if (situacao === "estoque-baixo" && !estoqueBaixo(p)) return false;
      if (situacao === "esgotados" && p.quantidade > 0) return false;
      return true;
    });
  }, [produtos, busca, categoriaId, situacao]);

  const chip = (ativo: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
      ativo ? "bg-brand-navy text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
    }`;

  return (
    <>
      <div className="flex flex-col gap-3">
        <label className="relative block w-full lg:max-w-sm">
          <span className="sr-only">Buscar produto</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto pelo nome"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(categoriaId === "todas")} onClick={() => setCategoriaId("todas")}>
            Todas as categorias
          </button>
          {categorias.map((c) => (
            <button key={c.id} type="button" className={chip(categoriaId === c.id)} onClick={() => setCategoriaId(c.id)}>
              {c.nome}
            </button>
          ))}
          <span aria-hidden className="mx-1 hidden w-px bg-slate-200 sm:block" />
          {SITUACOES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={chip(situacao === s.id)}
              onClick={() => setSituacao(situacao === s.id ? "todos" : s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 && produtos.length > 0 ? (
        <EmptyState
          compact
          eyebrow="Produtos"
          title="Nenhum produto encontrado"
          message="Ajuste a busca ou os filtros."
          icon={Package}
        />
      ) : (
        <ProductTable produtos={filtrados} categorias={categorias} onEdit={onEdit} onRemove={onRemove} />
      )}
    </>
  );
}

/** Painel lateral à direita para o formulário. Fecha pelo X, clicando fora
 *  ou com Esc. */
function PainelFormulario({ onFechar, children }: { onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Formulário de produto">
      <button type="button" aria-label="Fechar formulário" className="absolute inset-0 bg-slate-900/40" onClick={onFechar} />
      <div className="relative ml-auto h-full w-full max-w-lg overflow-y-auto bg-slate-50 p-4 shadow-2xl sm:rounded-xl">
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-500 hover:bg-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pt-8">{children}</div>
      </div>
    </div>
  );
}

export default function ProdutosPainel({
  produtos,
  categorias,
  loading,
  erro,
  onRetry,
  onEdit,
  onRemove,
  formulario,
  onFecharFormulario,
}: Props) {
  return (
    <>
      {loading ? (
        <TableSkeleton rows={4} columns={6} />
      ) : erro ? (
        <InlineErrorState message={erro} onRetry={onRetry} />
      ) : (
        <div className="flex flex-col gap-4">
          <Resumo produtos={produtos} />
          <ListaFiltrada produtos={produtos} categorias={categorias} onEdit={onEdit} onRemove={onRemove} />
        </div>
      )}

      {formulario && <PainelFormulario onFechar={onFecharFormulario}>{formulario}</PainelFormulario>}
    </>
  );
}
