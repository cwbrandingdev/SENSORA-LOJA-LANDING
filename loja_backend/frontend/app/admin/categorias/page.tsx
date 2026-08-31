"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import CategoryTable, {
  CategoryTableSkeleton,
} from "@/components/tables/CategoryTable";
import CategoryForm from "@/components/forms/CategoryForm";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormButton from "@/components/ui/FormButton";
import {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  removerCategoria,
} from "@/services/categorias";
import type { Categoria } from "@/lib/types";

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoriaToDelete, setCategoriaToDelete] = useState<Categoria | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  async function carregarCategorias() {
    setLoading(true);
    setLoadError("");
    try {
      const data: Categoria[] = await listarCategorias();
      setCategorias(data);
    } catch {
      setLoadError("Não foi possível carregar as categorias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarCategorias();
  }, []);

  async function handleSubmit(data: Partial<Categoria>) {
    try {
      if (editingCategory) {
        await atualizarCategoria(editingCategory.id, data);
        toast.success("Categoria atualizada com sucesso.");
      } else {
        await criarCategoria(data);
        toast.success("Categoria criada com sucesso.");
      }
      setDialogOpen(false);
      setEditingCategory(null);
      await carregarCategorias();
    } catch {
      toast.error(
        editingCategory
          ? "Não foi possível atualizar a categoria."
          : "Não foi possível criar a categoria.",
      );
    }
  }

  function handleEdit(categoria: Categoria) {
    setEditingCategory(categoria);
    setDialogOpen(true);
  }

  function handleNovaCategoria() {
    setEditingCategory(null);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditingCategory(null);
    }
  }

  async function handleConfirmRemove() {
    if (!categoriaToDelete) return;

    setDeleting(true);
    try {
      await removerCategoria(categoriaToDelete.id);
      toast.success("Categoria excluída com sucesso.");
      setCategoriaToDelete(null);
      await carregarCategorias();
    } catch {
      // Mantém o diálogo aberto em caso de erro, para o usuário tentar
      // novamente ou cancelar — só fecha automaticamente no sucesso.
      toast.error("Não foi possível excluir a categoria.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="motion-safe:animate-[fade-in-up_250ms_ease-out] flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-brand-navy">Categorias</h2>
          <p className="text-sm text-slate-500">
            Organize os produtos da loja em categorias.
          </p>
        </div>
        <FormButton
          variant="primary"
          onClick={handleNovaCategoria}
          className="w-fit active:scale-[0.98]"
        >
          + Nova categoria
        </FormButton>
      </div>

      {loadError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {loading ? (
        <CategoryTableSkeleton />
      ) : (
        <CategoryTable
          categorias={categorias}
          onEdit={handleEdit}
          onRemove={setCategoriaToDelete}
          onCreate={handleNovaCategoria}
        />
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        title={editingCategory ? "Editar categoria" : "Nova categoria"}
        description={
          editingCategory
            ? "Atualize as informações da categoria."
            : "Preencha os dados para cadastrar uma nova categoria."
        }
      >
        <CategoryForm
          initialData={editingCategory}
          onSubmit={handleSubmit}
          onCancel={() => handleDialogOpenChange(false)}
        />
      </Dialog>

      <ConfirmDialog
        open={Boolean(categoriaToDelete)}
        onOpenChange={(open: boolean) => {
          if (!open) setCategoriaToDelete(null);
        }}
        title="Excluir categoria?"
        description={
          categoriaToDelete
            ? `Tem certeza que deseja excluir "${categoriaToDelete.nome}"? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        onConfirm={handleConfirmRemove}
        loading={deleting}
      />
    </div>
  );
}
