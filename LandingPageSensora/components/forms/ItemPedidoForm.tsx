"use client";

// Portado de frontend/components/forms/ItemPedidoForm.js — mesmo
// comportamento. Único ajuste real: produto.preco é `string` na API interna
// (Decimal do Prisma serializa como string — ver lib/types/loja.ts), então
// o setValue de precoUnitario (campo numérico) converte explicitamente com
// Number(...) em vez de depender de coerção implícita do JS.
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormButton from "@/components/ui/FormButton";
import type { ItemPedido, Produto } from "@/lib/types/loja";

const itemPedidoSchema = z.object({
  produtoId: z.coerce
    .number({ error: "Produto é obrigatório" })
    .int()
    .positive("Selecione um produto"),
  quantidade: z.coerce
    .number({ error: "Quantidade é obrigatória" })
    .int("Quantidade deve ser um número inteiro")
    .min(1, "Quantidade mínima é 1"),
  precoUnitario: z.coerce
    .number({ error: "Preço unitário é obrigatório" })
    .min(0, "Preço unitário não pode ser negativo"),
});

type ItemPedidoFormInput = z.input<typeof itemPedidoSchema>;
export type ItemPedidoFormValues = z.output<typeof itemPedidoSchema>;

function toDefaultValues(item?: ItemPedido): ItemPedidoFormInput {
  return {
    produtoId: item?.produtoId ?? ("" as unknown as number),
    quantidade: item?.quantidade ?? ("" as unknown as number),
    precoUnitario: item?.precoUnitario ?? "",
  };
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

type ItemPedidoFormProps = {
  produtos: Produto[];
  initialData?: ItemPedido;
  onSubmit: (data: ItemPedidoFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

export default function ItemPedidoForm({
  produtos,
  initialData,
  onSubmit,
  onCancel,
}: ItemPedidoFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ItemPedidoFormInput, unknown, ItemPedidoFormValues>({
    resolver: zodResolver(itemPedidoSchema),
    defaultValues: toDefaultValues(initialData),
  });

  useEffect(() => {
    reset(toDefaultValues(initialData));
  }, [initialData, reset]);

  function handleProdutoChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const produtoId = Number(event.target.value);
    const produto = produtos.find((p) => p.id === produtoId);
    if (produto) {
      setValue("precoUnitario", Number(produto.preco));
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
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

      <div className="flex gap-2">
        <FormButton type="submit" variant="primary" disabled={isSubmitting}>
          {initialData ? "Salvar item" : "Adicionar item"}
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
