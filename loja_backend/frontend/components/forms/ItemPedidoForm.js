"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Button from "@/components/ui/Button";

const itemPedidoSchema = z.object({
  produtoId: z.coerce
    .number({ invalid_type_error: "Produto é obrigatório" })
    .int()
    .positive("Selecione um produto"),
  quantidade: z.coerce
    .number({ invalid_type_error: "Quantidade é obrigatória" })
    .int("Quantidade deve ser um número inteiro")
    .min(1, "Quantidade mínima é 1"),
  precoUnitario: z.coerce
    .number({ invalid_type_error: "Preço unitário é obrigatório" })
    .min(0, "Preço unitário não pode ser negativo"),
});

function toDefaultValues(item) {
  return {
    produtoId: item?.produtoId ?? "",
    quantidade: item?.quantidade ?? "",
    precoUnitario: item?.precoUnitario ?? "",
  };
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

export default function ItemPedidoForm({
  produtos,
  initialData,
  onSubmit,
  onCancel,
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(itemPedidoSchema),
    defaultValues: toDefaultValues(initialData),
  });

  useEffect(() => {
    reset(toDefaultValues(initialData));
  }, [initialData, reset]);

  function handleProdutoChange(event) {
    const produtoId = Number(event.target.value);
    const produto = produtos.find((p) => p.id === produtoId);
    if (produto) {
      setValue("precoUnitario", produto.preco);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="produtoId" className={labelClass}>
          Produto
        </label>
        <select
          id="produtoId"
          className={inputClass}
          {...register("produtoId", { onChange: handleProdutoChange })}
        >
          <option value="">Selecione um produto</option>
          {produtos.map((produto) => (
            <option key={produto.id} value={produto.id}>
              {produto.nome}
            </option>
          ))}
        </select>
        {errors.produtoId && (
          <p className={errorClass}>{errors.produtoId.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="quantidade" className={labelClass}>
          Quantidade
        </label>
        <input
          id="quantidade"
          type="number"
          className={inputClass}
          {...register("quantidade")}
        />
        {errors.quantidade && (
          <p className={errorClass}>{errors.quantidade.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="precoUnitario" className={labelClass}>
          Preço unitário
        </label>
        <input
          id="precoUnitario"
          type="number"
          step="0.01"
          className={inputClass}
          {...register("precoUnitario")}
        />
        {errors.precoUnitario && (
          <p className={errorClass}>{errors.precoUnitario.message}</p>
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
              ? "Salvar item"
              : "Adicionar item"}
        </Button>
      </div>
    </form>
  );
}
