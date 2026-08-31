"use client";

import { useEffect, useState } from "react";
import ProductTable from "@/components/tables/ProductTable";
import ProductForm, { type ProductFormValues } from "@/components/forms/ProductForm";
import FormButton from "@/components/ui/FormButton";
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

export default function ProdutosPage() {
  const toast = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Produto | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  async function carregarProdutos() {
    setLoading(true);
    try {
      const data = await listarProdutos();
      setProdutos(data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível carregar os produtos."));
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
        <p className="text-sm text-slate-500">Carregando produtos...</p>
      ) : (
        <ProductTable
          produtos={produtos}
          categorias={categorias}
          onEdit={handleEdit}
          onRemove={handleRemove}
        />
      )}
    </div>
  );
}
