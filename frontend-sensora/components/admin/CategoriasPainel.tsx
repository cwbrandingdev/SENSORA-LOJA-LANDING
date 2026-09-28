"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { FolderOpen, Package, PackageX, Pencil, Search, Tag, Trash2, X } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/InlineErrorState";
import RowActions from "@/components/ui/RowActions";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { statusEstoque } from "@/lib/estoque";
import type { Categoria, Produto } from "@/lib/types/loja";
import { listarProdutos } from "@/services/produtos";

// Lista de categorias do Admin: números de resumo no topo e um quadro com
// uma coluna por categoria mostrando os seus produtos. O formulário de
// criar/editar abre num painel lateral à direita. Toda a lógica
// (carregar/criar/editar/remover/revalidar) continua na página — este
// componente só LÊ os produtos (GET /produtos, mesma rota da página de
// Produtos) para as contagens e as colunas.

type Props = {
  categorias: Categoria[];
  loading: boolean;
  erro: string | null;
  onRetry: () => void;
  onEdit: (categoria: Categoria) => void;
  onRemove: (categoria: Categoria) => void;
  /** Formulário de criar/editar já montado pela página (ou null se fechado). */
  formulario: ReactNode | null;
  onFecharFormulario: () => void;
};

const formatPrice = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function contagem(n: number) {
  return `${n} ${n === 1 ? "produto" : "produtos"}`;
}

function Miniatura({ produto }: { produto: Produto }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 border-white bg-slate-100">
      {produto.imagemUrl && !falhou ? (
        <Image
          src={produto.imagemUrl}
          alt={produto.nome}
          fill
          unoptimized
          sizes="40px"
          className="object-cover"
          onError={() => setFalhou(true)}
        />
      ) : (
        <span aria-hidden className="flex h-full w-full items-center justify-center text-slate-300">
          <Package className="h-4 w-4" />
        </span>
      )}
    </span>
  );
}

function Resumo({
  categorias,
  porCategoria,
  produtosCarregados,
}: {
  categorias: Categoria[];
  porCategoria: Map<number, Produto[]>;
  produtosCarregados: boolean;
}) {
  const comProdutos = categorias.filter((c) => (porCategoria.get(c.id)?.length ?? 0) > 0).length;
  const semCategoria = porCategoria.get(-1)?.length ?? 0;
  const itens = [
    { rotulo: "Categorias", valor: categorias.length, icone: Tag, tom: "text-brand-navy bg-brand-navy/5", sempre: true },
    { rotulo: "Com produtos", valor: comProdutos, icone: Package, tom: "text-emerald-700 bg-emerald-50", sempre: false },
    { rotulo: "Vazias", valor: categorias.length - comProdutos, icone: FolderOpen, tom: "text-slate-700 bg-slate-100", sempre: false },
    { rotulo: "Produtos sem categoria", valor: semCategoria, icone: PackageX, tom: "text-amber-700 bg-amber-50", sempre: false },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map(({ rotulo, valor, icone: Icone, tom, sempre }) => (
        <div key={rotulo} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tom}`}>
            <Icone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            {/* Sem a leitura de produtos, só a contagem de categorias é certa. */}
            <p className="text-2xl font-semibold tabular-nums text-slate-900">
              {produtosCarregados || sempre ? valor : "—"}
            </p>
            <p className="truncate text-xs text-slate-500">{rotulo}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Quadro({
  categorias,
  porCategoria,
  produtosCarregados,
  onEdit,
  onRemove,
}: {
  categorias: Categoria[];
  porCategoria: Map<number, Produto[]>;
  produtosCarregados: boolean;
  onEdit: Props["onEdit"];
  onRemove: Props["onRemove"];
}) {
  const [busca, setBusca] = useState("");
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return categorias;
    return categorias.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        c.slug.toLowerCase().includes(termo) ||
        (c.descricao ?? "").toLowerCase().includes(termo),
    );
  }, [categorias, busca]);

  return (
    <>
      <label className="relative block w-full lg:max-w-sm">
        <span className="sr-only">Buscar categoria</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar categoria"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      </label>

      {categorias.length === 0 ? (
        <EmptyState
          compact
          eyebrow="Categorias"
          title="Nenhuma categoria cadastrada"
          message="Cadastre a primeira categoria para organizar os produtos."
          icon={Tag}
        />
      ) : filtradas.length === 0 ? (
        <EmptyState compact eyebrow="Categorias" title="Nenhuma categoria encontrada" message="Ajuste a busca." icon={Tag} />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {filtradas.map((c) => {
            const produtos = porCategoria.get(c.id) ?? [];
            return (
              <section key={c.id} className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                <header className="flex items-start justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900" title={c.nome}>
                      {c.nome}
                    </p>
                    <p className="truncate text-xs text-slate-500" title={c.descricao ?? c.slug}>
                      {produtosCarregados ? contagem(produtos.length) : "—"} · {c.slug}
                    </p>
                  </div>
                  <RowActions
                    actions={[
                      { label: "Editar", icon: Pencil, onClick: () => onEdit(c) },
                      { label: "Remover", icon: Trash2, variant: "danger", onClick: () => onRemove(c) },
                    ]}
                  />
                </header>
                <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto p-3">
                  {produtos.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                      Nenhum produto
                    </li>
                  ) : (
                    produtos.map((p) => {
                      const estoque = statusEstoque(p.quantidade);
                      return (
                        <li key={p.id} className="flex items-center gap-2.5 rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-100">
                          <Miniatura produto={p} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-800">{p.nome}</p>
                            <p className="text-[11px] tabular-nums text-slate-500">
                              {formatPrice.format(p.preco)}
                              {!p.ativo && " · inativo"}
                            </p>
                          </div>
                          <span
                            aria-label={estoque === "ESGOTADO" ? "Esgotado" : `${p.quantidade} em estoque`}
                            title={estoque === "ESGOTADO" ? "Esgotado" : `${p.quantidade} em estoque`}
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              estoque === "ESGOTADO" ? "bg-red-500" : estoque === "DISPONIVEL" ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                        </li>
                      );
                    })
                  )}
                </ul>
              </section>
            );
          })}
        </div>
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
    <div className="fixed inset-0 z-50 flex p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Formulário de categoria">
      <button type="button" aria-label="Fechar formulário" className="absolute inset-0 bg-slate-900/40" onClick={onFechar} />
      <div className="relative ml-auto h-full w-full max-w-md overflow-y-auto bg-slate-50 p-4 shadow-2xl sm:rounded-xl">
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

export default function CategoriasPainel({
  categorias,
  loading,
  erro,
  onRetry,
  onEdit,
  onRemove,
  formulario,
  onFecharFormulario,
}: Props) {
  const [produtos, setProdutos] = useState<Produto[] | null>(null);

  // Só leitura, para as contagens e as colunas. Recarrega quando a página
  // recarrega as categorias (criar/editar/remover troca a referência).
  useEffect(() => {
    let cancelado = false;
    listarProdutos()
      .then((lista) => {
        if (!cancelado) setProdutos(lista);
      })
      .catch(() => {
        // Sem produtos: contagens viram "—", a gestão de categorias segue.
      });
    return () => {
      cancelado = true;
    };
  }, [categorias]);

  // -1 = produto sem categoria (ou com categoria que não existe mais).
  const porCategoria = useMemo(() => {
    const mapa = new Map<number, Produto[]>();
    const ids = new Set(categorias.map((c) => c.id));
    for (const p of produtos ?? []) {
      const chave = p.categoriaId != null && ids.has(p.categoriaId) ? p.categoriaId : -1;
      mapa.set(chave, [...(mapa.get(chave) ?? []), p]);
    }
    return mapa;
  }, [produtos, categorias]);

  const produtosCarregados = produtos !== null;

  return (
    <>
      {loading ? (
        <TableSkeleton rows={3} columns={3} />
      ) : erro ? (
        <InlineErrorState message={erro} onRetry={onRetry} />
      ) : (
        <div className="flex flex-col gap-4">
          <Resumo categorias={categorias} porCategoria={porCategoria} produtosCarregados={produtosCarregados} />
          <Quadro
            categorias={categorias}
            porCategoria={porCategoria}
            produtosCarregados={produtosCarregados}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        </div>
      )}

      {formulario && <PainelFormulario onFechar={onFecharFormulario}>{formulario}</PainelFormulario>}
    </>
  );
}
