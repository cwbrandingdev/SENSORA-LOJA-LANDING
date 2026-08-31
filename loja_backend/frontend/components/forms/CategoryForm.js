"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Button from "@/components/ui/Button";

const categorySchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional(),
});

function toDefaultValues(categoria) {
  return {
    nome: categoria?.nome ?? "",
    descricao: categoria?.descricao ?? "",
  };
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

export default function CategoryForm({ initialData, onSubmit, onCancel }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: toDefaultValues(initialData),
  });

  useEffect(() => {
    reset(toDefaultValues(initialData));
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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

      <div className="mt-1 flex justify-end gap-2 border-t border-slate-100 pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting
            ? "Salvando..."
            : initialData
              ? "Salvar edição"
              : "Criar categoria"}
        </Button>
      </div>
    </form>
  );
}
