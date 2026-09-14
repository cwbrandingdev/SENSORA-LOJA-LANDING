"use client";

import { useEffect, useMemo, useState } from "react";
import ProductTable from "@/components/tables/ProductTable";
import ProductForm, { type ProductFormValues } from "@/components/forms/ProductForm";
import FormButton from "@/components/ui/FormButton";
import TableSkeleton from "@/components/ui/TableSkeleton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  listarProdutos,
  criarProduto,
  atualizarProduto,
  removerProduto,
} from "@/services/produtos";
import { listarCategorias } from "@/services/categorias";
import { revalidarProdutos } from "@/lib/actions";
import type { Categoria, CreateProdutoPayload, Produto } from "@/lib/types/loja";

// Converte o valor cru do form (categoriaId como string do <select>, "" =
// sem categoria) para o payload que a API espera (categoriaId?: number).
function toPayload(data: ProductFormValues): CreateProdutoPayload {
  return {
    nome: data.nome,
    descricao: data.descricao || undefined,
    preco: data.preco,
    quantidade: data.quantidade,
    categoriaId: data.categoriaId ? Number(data.categoriaId) : undefined,
    imagemUrl: data.imagemUrl || undefined,
    ativo: data.ativo,
    destaque: data.destaque,
  };
}

// Organização visual (Admin → Produtos) — separa a lista em seções por
// categoria, reaproveitando o ProductTable já existente (uma instância por
// seção, cada uma só com a fatia de produtos daquela categoria). Nenhuma
// chamada nova à API: `produtos` e `categorias` já estão carregados inteiros
// no cliente (ver carregarProdutos/carregarCategorias acima).
//
// Ordem fixa pedida (por slug real, nunca por nome digitado — evita
// depender de acento/maiúscula): Velas, Sprays, Difusores, Kits primeiro;
// qualquer outra categoria cadastrada depois (ordem alfabética, sem
// manutenção manual quando uma categoria nova surgir); "Sem categoria" por
// último, sempre. Uma categoria da ordem fixa que ainda não existir na API
// simplesmente não aparece — nunca inventamos uma seção pra categoria que
// não existe de verdade.
const ORDEM_SLUGS_PRINCIPAIS = [
  "velas-aromaticas",
  "sprays-de-ambientes",
  "difusores-de-aroma",
  "kits",
];

type GrupoProdutos = {
  chave: string;
  nome: string;
  produtos: Produto[];
};

function agruparProdutosPorCategoria(
  produtos: Produto[],
  categorias: Categoria[],
): GrupoProdutos[] {
  const categoriasPorId = new Map(categorias.map((categoria) => [categoria.id, categoria]));

  const principais = ORDEM_SLUGS_PRINCIPAIS.map((slug) =>
    categorias.find((categoria) => categoria.slug === slug),
  ).filter((categoria): categoria is Categoria => Boolean(categoria));

  const idsPrincipais = new Set(principais.map((categoria) => categoria.id));

  // "Outras categorias": qualquer categoria real que não esteja na ordem
  // fixa acima (ex.: uma categoria nova, ou a categoria de teste já vista
  // na vistoria) — mantém o próprio nome como título da seção (não junta
  // tudo num balde anônimo, pra não perder identificação rápida do produto).
  const outras = categorias
    .filter((categoria) => !idsPrincipais.has(categoria.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const gruposCategoria: GrupoProdutos[] = [...principais, ...outras].map((categoria) => ({
    chave: `categoria-${categoria.id}`,
    nome: categoria.nome,
    produtos: produtos.filter((produto) => produto.categoriaId === categoria.id),
  }));

  // Produto sem categoriaId, ou com um categoriaId que não bate com nenhuma
  // categoria carregada (categoria removida entretanto, ou falha ao
  // carregar `categorias`) — nunca some da lista, sempre cai aqui.
  const semCategoria = produtos.filter(
    (produto) => produto.categoriaId == null || !categoriasPorId.has(produto.categoriaId),
  );

  return [
    ...gruposCategoria,
    { chave: "sem-categoria", nome: "Sem categoria", produtos: semCategoria },
  ];
}

export default function ProdutosPage() {
  const toast = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  // Refinamento visual (Admin) — eco persistente do erro (aditivo: o toast
  // já existente abaixo continua disparando exatamente como antes).
  const [erro, setErro] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Produto | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  const grupos = useMemo(
    () => agruparProdutosPorCategoria(produtos, categorias),
    [produtos, categorias],
  );

  async function carregarProdutos() {
    setLoading(true);
    setErro(null);
    try {
      const data = await listarProdutos();
      setProdutos(data);
    } catch (err) {
      const mensagem = getErrorMessage(err, "Não foi possível carregar os produtos.");
      toast.error(mensagem);
      setErro(mensagem);
    } finally {
      setLoading(false);
    }
  }

  async function carregarCategorias() {
    try {
      const data = await listarCategorias();
      setCategorias(data);
    } catch {
      // Select de categoria fica só com "Sem categoria" — não bloqueia o
      // cadastro do resto do produto por uma falha secundária.
    }
  }

  useEffect(() => {
    carregarProdutos();
    carregarCategorias();
  }, []);

  async function handleSubmit(data: ProductFormValues) {
    const payload = toPayload(data);
    const editando = Boolean(editingProduct);
    try {
      if (editingProduct) {
        await atualizarProduto(editingProduct.id, payload);
      } else {
        await criarProduto(payload);
      }
      setShowForm(false);
      setEditingProduct(undefined);
      toast.success(editando ? "Produto atualizado com sucesso." : "Produto criado com sucesso.");
      await Promise.all([carregarProdutos(), revalidarProdutos()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar o produto."));
    }
  }

  function handleEdit(produto: Produto) {
    setEditingProduct(produto);
    setShowForm(true);
  }

  async function handleRemove(produto: Produto) {
    if (!window.confirm(`Remover o produto "${produto.nome}"?`)) {
      return;
    }

    try {
      await removerProduto(produto.id);
      toast.success("Produto excluído com sucesso.");
      await Promise.all([carregarProdutos(), revalidarProdutos()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível remover o produto."));
    }
  }

  function handleNovoProduto() {
    setEditingProduct(undefined);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingProduct(undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-brand-navy">Produtos</h2>
        <FormButton variant="primary" onClick={handleNovoProduto}>
          Novo produto
        </FormButton>
      </div>

      {showForm && (
        <ProductForm
          initialData={editingProduct}
          categorias={categorias}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {loading ? (
        <TableSkeleton rows={4} columns={6} />
      ) : erro ? (
        <InlineErrorState message={erro} onRetry={carregarProdutos} />
      ) : (
        <div className="flex flex-col gap-10">
          {grupos.map((grupo) => (
            <section key={grupo.chave} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2 border-b border-slate-200 pb-2">
                <h3 className="text-base font-semibold text-brand-navy">{grupo.nome}</h3>
                <span className="text-xs font-medium text-slate-400">
                  · {grupo.produtos.length}{" "}
                  {grupo.produtos.length === 1 ? "produto" : "produtos"}
                </span>
              </div>
              <ProductTable
                produtos={grupo.produtos}
                categorias={categorias}
                onEdit={handleEdit}
                onRemove={handleRemove}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
