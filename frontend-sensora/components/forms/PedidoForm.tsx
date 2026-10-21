"use client";

// Portado de frontend/components/forms/PedidoForm.js — mesmo comportamento,
// exceto pelo campo `status` (Etapa 8.1, fechamento do HIGH-01 — "Admin
// order CRUD can fabricate PAGO"): não existe venda manual no sistema, então
// este formulário nunca deixa o admin escolher o estado financeiro de um
// pedido. Todo pedido criado nasce PENDENTE (decidido pelo servidor); a
// única forma legítima de um pedido virar PAGO é o fluxo real de pagamento
// (Checkout/Asaas + webhook CHECKOUT_PAID) — nunca este CRUD. O backend
// (CreatePedidoDto/UpdatePedidoDto) reforça isso independentemente desta UI:
// enviar `status` aqui seria rejeitado pelo ValidationPipe
// (forbidNonWhitelisted).
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormButton from "@/components/ui/FormButton";
import { StatusPedido, type Pedido } from "@/lib/types/loja";

const pedidoSchemaPendente = z.object({
  numero: z.string().min(1, "Número é obrigatório"),
  data: z.string().min(1, "Data é obrigatória"),
});

const pedidoSchemaPago = z.object({
  codigoRastreio: z.string().max(80, "Máximo de 80 caracteres").optional(),
});

export type PedidoFormValues =
  | z.infer<typeof pedidoSchemaPendente>
  | z.infer<typeof pedidoSchemaPago>;

function toDefaultValues(pedido?: Pedido): PedidoFormValues {
  if (pedido?.status === StatusPedido.PAGO) {
    return { codigoRastreio: pedido.codigoRastreio ?? "" };
  }
  return {
    numero: pedido?.numero ?? "",
    data: pedido?.data ? pedido.data.slice(0, 10) : "",
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
  const modoPago = initialData?.status === StatusPedido.PAGO;

  const formPendente = useForm<z.infer<typeof pedidoSchemaPendente>>({
    resolver: zodResolver(pedidoSchemaPendente),
    defaultValues: toDefaultValues(initialData) as z.infer<typeof pedidoSchemaPendente>,
  });

  const formPago = useForm<z.infer<typeof pedidoSchemaPago>>({
    resolver: zodResolver(pedidoSchemaPago),
    defaultValues: toDefaultValues(initialData) as z.infer<typeof pedidoSchemaPago>,
  });

  useEffect(() => {
    if (modoPago) {
      formPago.reset(toDefaultValues(initialData) as z.infer<typeof pedidoSchemaPago>);
    } else {
      formPendente.reset(
        toDefaultValues(initialData) as z.infer<typeof pedidoSchemaPendente>,
      );
    }
  }, [initialData, modoPago, formPago, formPendente]);

  if (modoPago && initialData) {
    const {
      register,
      handleSubmit,
      formState: { errors, isSubmitting },
    } = formPago;

    return (
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p>
            <span className="font-medium text-slate-800">Cliente:</span>{" "}
            {initialData.clienteNome ?? "—"}
          </p>
          <p className="mt-1 text-slate-600">{initialData.clienteEmail ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-500">
            Pedido {initialData.numero} · somente o rastreio pode ser alterado aqui.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="codigoRastreio" className={labelClass}>
            Código de rastreio
          </label>
          <input
            id="codigoRastreio"
            type="text"
            maxLength={80}
            placeholder="Ex.: AA123456789BR"
            className={inputClass}
            {...register("codigoRastreio")}
          />
          {errors.codigoRastreio && (
            <p className={errorClass}>{errors.codigoRastreio.message}</p>
          )}
          <p className="text-xs text-slate-500">
            O cliente vê este código em Meus pedidos, com link para o Melhor Rastreio.
          </p>
        </div>

        <div className="flex gap-2">
          <FormButton type="submit" variant="primary" disabled={isSubmitting}>
            Salvar rastreio
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

  if (initialData && initialData.status !== StatusPedido.PENDENTE) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-800">Cliente:</span>{" "}
          {initialData.clienteNome ?? "—"} ({initialData.clienteEmail ?? "—"})
        </p>
        <p className="mt-3">
          Este pedido não pode ser editado por aqui. Use &quot;Marcar como enviado&quot; na
          listagem enquanto aguarda envio.
        </p>
        {onCancel && (
          <div className="mt-4">
            <FormButton type="button" variant="ghost" onClick={onCancel}>
              Fechar
            </FormButton>
          </div>
        )}
      </div>
    );
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = formPendente;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      {initialData && (
        <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p>
            <span className="font-medium text-slate-800">Cliente:</span>{" "}
            {initialData.clienteNome ?? "—"}
          </p>
          <p className="mt-1 text-slate-600">{initialData.clienteEmail ?? "—"}</p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="numero" className={labelClass}>
          Número
        </label>
        <input id="numero" type="text" className={inputClass} {...register("numero")} />
        {errors.numero && <p className={errorClass}>{errors.numero.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="data" className={labelClass}>
          Data
        </label>
        <input id="data" type="date" className={inputClass} {...register("data")} />
        {errors.data && <p className={errorClass}>{errors.data.message}</p>}
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
