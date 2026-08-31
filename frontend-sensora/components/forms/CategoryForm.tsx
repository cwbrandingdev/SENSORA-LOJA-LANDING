"use client";

// Portado de frontend/components/forms/CategoryForm.js — mesmo schema,
// mesmo comportamento. Só tipado.
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormButton from "@/components/ui/FormButton";
import type { Categoria } from "@/lib/types/loja";

const categorySchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

function toDefaultValues(categoria?: Categoria): CategoryFormValues {
  return {
    nome: categoria?.nome ?? "",
    descricao: categoria?.descricao ?? "",
  };
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

type CategoryFormProps = {
  initialData?: Categoria;
  onSubmit: (data: CategoryFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

export default function CategoryForm({ initialData, onSubmit, onCancel }: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: toDefaultValues(initialData),
  });

  useEffect(() => {
    reset(toDefaultValues(initialData));
  }, [initialData, reset]);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="nome" className={labelClass}>
          Nome
        </label>
        <input id="nome" type="text" className={inputClass} {...register("nome")} />
        {errors.nome && <p className={errorClass}>{errors.nome.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="descricao" className={labelClass}>
          Descrição
        </label>
        <input
          id="descricao"
          type="text"
          className={inputClass}
          {...register("descricao")}
        />
        {errors.descricao && (
          <p className={errorClass}>{errors.descricao.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <FormButton type="submit" variant="primary" disabled={isSubmitting}>
          {initialData ? "Salvar edição" : "Criar categoria"}
        </FormButton>

        {onCancel && (
          <FormButton type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </FormButton>
        )}
      </div>
    </form>
  );
}
