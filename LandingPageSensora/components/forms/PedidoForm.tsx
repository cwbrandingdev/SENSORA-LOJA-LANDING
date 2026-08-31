"use client";

// Portado de frontend/components/forms/PedidoForm.js — mesmo comportamento.
// Única adaptação: o z.enum(["PENDENTE","PAGO","CANCELADO"]) literal virou
// z.nativeEnum(StatusPedido), reaproveitando o enum que já existe em
// lib/types/loja.ts em vez de duplicar os três valores — mesmas opções
// aceitas, mesmo runtime.
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormButton from "@/components/ui/FormButton";
import { StatusPedido, type Pedido } from "@/lib/types/loja";

const pedidoSchema = z.object({
  numero: z.string().min(1, "Número é obrigatório"),
  data: z.string().min(1, "Data é obrigatória"),
  status: z.nativeEnum(StatusPedido),
});

export type PedidoFormValues = z.infer<typeof pedidoSchema>;

function toDefaultValues(pedido?: Pedido): PedidoFormValues {
  return {
    numero: pedido?.numero ?? "",
    data: pedido?.data ? pedido.data.slice(0, 10) : "",
    status: pedido?.status ?? StatusPedido.PENDENTE,
  };
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

type PedidoFormProps = {
  initialData?: Pedido;
  onSubmit: (data: PedidoFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

export default function PedidoForm({ initialData, onSubmit, onCancel }: PedidoFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PedidoFormValues>({
    resolver: zodResolver(pedidoSchema),
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
        <label htmlFor="numero" className={labelClass}>
          Número
        </label>
        <input
          id="numero"
          type="text"
          className={inputClass}
          {...register("numero")}
        />
        {errors.numero && <p className={errorClass}>{errors.numero.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="data" className={labelClass}>
          Data
        </label>
        <input id="data" type="date" className={inputClass} {...register("data")} />
        {errors.data && <p className={errorClass}>{errors.data.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="status" className={labelClass}>
          Status
        </label>
        <select id="status" className={inputClass} {...register("status")}>
          <option value="PENDENTE">Pendente</option>
          <option value="PAGO">Pago</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        {errors.status && <p className={errorClass}>{errors.status.message}</p>}
      </div>

      <div className="flex gap-2">
        <FormButton type="submit" variant="primary" disabled={isSubmitting}>
          {initialData ? "Salvar edição" : "Criar pedido"}
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
