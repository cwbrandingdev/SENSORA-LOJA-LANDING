"use client";

import { useEffect, useState } from "react";
import CategoryTable from "@/components/tables/CategoryTable";
import CategoryForm, { type CategoryFormValues } from "@/components/forms/CategoryForm";
import FormButton from "@/components/ui/FormButton";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  removerCategoria,
} from "@/services/categorias";
import { revalidarCategorias } from "@/lib/actions";
import type { Categoria } from "@/lib/types/loja";

export default function CategoriasPage() {
  const toast = useToast();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Categoria | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  async function carregarCategorias() {
    setLoading(true);
    try {
      const data = await listarCategorias();
      setCategorias(data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível carregar as categorias."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarCategorias();
  }, []);

  async function handleSubmit(data: CategoryFormValues) {
    const editando = Boolean(editingCategory);
    try {
      if (editingCategory) {
        await atualizarCategoria(editingCategory.id, data);
      } else {
        await criarCategoria(data);
      }
      setShowForm(false);
      setEditingCategory(undefined);
      toast.success(editando ? "Categoria atualizada com sucesso." : "Categoria criada com sucesso.");
      await Promise.all([carregarCategorias(), revalidarCategorias()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar a categoria."));
    }
  }

  function handleEdit(categoria: Categoria) {
    setEditingCategory(categoria);
    setShowForm(true);
  }

  async function handleRemove(categoria: Categoria) {
    if (!window.confirm(`Remover a categoria "${categoria.nome}"?`)) {
      return;
    }

    try {
      await removerCategoria(categoria.id);
      toast.success("Categoria excluída com sucesso.");
      await Promise.all([carregarCategorias(), revalidarCategorias()]);
    } catch (err) {
      // getErrorMessage já preserva a mensagem específica do backend (ex.:
      // 409 de categoria com produtos vinculados) quando existir.
      toast.error(getErrorMessage(err, "Não foi possível remover a categoria."));
    }
  }

  function handleNovaCategoria() {
    setEditingCategory(undefined);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingCategory(undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-brand-navy">Categorias</h2>
        <FormButton variant="primary" onClick={handleNovaCategoria}>
          Nova categoria
        </FormButton>
      </div>

      {showForm && (
        <CategoryForm
          initialData={editingCategory}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando categorias...</p>
      ) : (
        <CategoryTable categorias={categorias} onEdit={handleEdit} onRemove={handleRemove} />
      )}
    </div>
  );
}
