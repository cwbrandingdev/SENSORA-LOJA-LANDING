"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import ProductTable, {
  ProductTableSkeleton,
} from "@/components/tables/ProductTable";
import ProductForm from "@/components/forms/ProductForm";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormButton from "@/components/ui/FormButton";
import {
  listarProdutos,
  criarProduto,
  atualizarProduto,
  removerProduto,
} from "@/services/produtos";
import type { Produto } from "@/lib/types";

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [produtoToDelete, setProdutoToDelete] = useState<Produto | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregarProdutos() {
    setLoading(true);
    setLoadError("");
    try {
      const data: Produto[] = await listarProdutos();
      setProdutos(data);
    } catch {
      setLoadError("Não foi possível carregar os produtos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarProdutos();
  }, []);

  async function handleSubmit(data: Partial<Produto>) {
    try {
      if (editingProduct) {
        await atualizarProduto(editingProduct.id, data);
        toast.success("Produto atualizado com sucesso.");
      } else {
        await criarProduto(data);
        toast.success("Produto criado com sucesso.");
      }
      setDialogOpen(false);
      setEditingProduct(null);
      await carregarProdutos();
    } catch {
      toast.error(
        editingProduct
          ? "Não foi possível atualizar o produto."
          : "Não foi possível criar o produto."
      );
    }
  }

  function handleEdit(produto: Produto) {
    setEditingProduct(produto);
    setDialogOpen(true);
  }

  function handleNovoProduto() {
    setEditingProduct(null);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditingProduct(null);
    }
  }

  async function handleConfirmRemove() {
    if (!produtoToDelete) return;

    setDeleting(true);
    try {
      await removerProduto(produtoToDelete.id);
      toast.success("Produto excluído com sucesso.");
      setProdutoToDelete(null);
      await carregarProdutos();
    } catch {
      // Mantém o diálogo aberto em caso de erro, para o usuário tentar
      // novamente ou cancelar — só fecha automaticamente no sucesso.
      toast.error("Não foi possível excluir o produto.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="motion-safe:animate-[fade-in-up_250ms_ease-out] flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-brand-navy">Produtos</h2>
          <p className="text-sm text-slate-500">
            Gerencie o catálogo de produtos da loja.
          </p>
        </div>
        <FormButton
          variant="primary"
          onClick={handleNovoProduto}
          className="w-fit active:scale-[0.98]"
        >
          + Novo produto
        </FormButton>
      </div>

      {loadError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {loading ? (
        <ProductTableSkeleton />
      ) : (
        <ProductTable
          produtos={produtos}
          onEdit={handleEdit}
          onRemove={setProdutoToDelete}
          onCreate={handleNovoProduto}
        />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        title={editingProduct ? "Editar produto" : "Novo produto"}
        description={
          editingProduct
            ? "Atualize as informações do produto."
            : "Preencha os dados para cadastrar um novo produto."
        }
      >
        <ProductForm
          initialData={editingProduct}
          onSubmit={handleSubmit}
          onCancel={() => handleDialogOpenChange(false)}
        />
      </Dialog>

      <ConfirmDialog
        open={Boolean(produtoToDelete)}
        onOpenChange={(open: boolean) => {
          if (!open) setProdutoToDelete(null);
        }}
        title="Excluir produto?"
        description={
          produtoToDelete
            ? `Tem certeza que deseja excluir "${produtoToDelete.nome}"? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        onConfirm={handleConfirmRemove}
        loading={deleting}
      />
    </div>
  );
}
