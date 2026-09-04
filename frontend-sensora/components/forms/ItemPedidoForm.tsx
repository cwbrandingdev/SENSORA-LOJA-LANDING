"use client";

// Portado de frontend/components/forms/ItemPedidoForm.js, exceto pelo campo
// `precoUnitario` (Etapa 8.1, fechamento do HIGH-01 — "Admin order CRUD can
// fabricate PAGO"): o preço de um item nunca é escolhido pelo admin — o
// backend (ItensPedidoService) sempre deriva o preço do Produto real no
// momento da criação/edição, a mesma fonte de verdade que o Checkout usa.
// Enviar `precoUnitario` seria rejeitado pelo ValidationPipe
// (CreateItemPedidoDto não whitelist mais este campo).
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
});

type ItemPedidoFormInput = z.input<typeof itemPedidoSchema>;
export type ItemPedidoFormValues = z.output<typeof itemPedidoSchema>;

function toDefaultValues(item?: ItemPedido): ItemPedidoFormInput {
  return {
    produtoId: item?.produtoId ?? ("" as unknown as number),
    quantidade: item?.quantidade ?? ("" as unknown as number),
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
    formState: { errors, isSubmitting },
  } = useForm<ItemPedidoFormInput, unknown, ItemPedidoFormValues>({
    resolver: zodResolver(itemPedidoSchema),
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
        <label htmlFor="produtoId" className={labelClass}>
          Produto
        </label>
        <select id="produtoId" className={inputClass} {...register("produtoId")}>
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
