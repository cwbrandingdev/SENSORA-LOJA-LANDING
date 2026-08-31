"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Button from "@/components/ui/Button";

const pedidoSchema = z.object({
  numero: z.string().min(1, "Número é obrigatório"),
  data: z.string().min(1, "Data é obrigatória"),
  status: z.enum(["PENDENTE", "PAGO", "CANCELADO"]),
});

function toDefaultValues(pedido) {
  return {
    numero: pedido?.numero ?? "",
    data: pedido?.data ? pedido.data.slice(0, 10) : "",
    status: pedido?.status ?? "PENDENTE",
  };
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

export default function PedidoForm({ initialData, onSubmit, onCancel }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(pedidoSchema),
    defaultValues: toDefaultValues(initialData),
  });

  useEffect(() => {
    reset(toDefaultValues(initialData));
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
              : "Criar pedido"}
        </Button>
      </div>
    </form>
  );
}
