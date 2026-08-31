"use client";

// Portado de frontend/components/forms/ClientForm.js — mesmo schema,
// mesmo comportamento. Só tipado.
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormButton from "@/components/ui/FormButton";
import type { Cliente } from "@/lib/types/loja";

const clientSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  telefone: z.string().min(1, "Telefone é obrigatório"),
  cpf: z.string().min(1, "CPF é obrigatório"),
  endereco: z.string().min(1, "Endereço é obrigatório"),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

function toDefaultValues(cliente?: Cliente): ClientFormValues {
  return {
    nome: cliente?.nome ?? "",
    email: cliente?.email ?? "",
    telefone: cliente?.telefone ?? "",
    cpf: cliente?.cpf ?? "",
    endereco: cliente?.endereco ?? "",
  };
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

type ClientFormProps = {
  initialData?: Cliente;
  onSubmit: (data: ClientFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

export default function ClientForm({ initialData, onSubmit, onCancel }: ClientFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
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
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          type="email"
          className={inputClass}
          {...register("email")}
        />
        {errors.email && <p className={errorClass}>{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="telefone" className={labelClass}>
          Telefone
        </label>
        <input
          id="telefone"
          type="text"
          className={inputClass}
          {...register("telefone")}
        />
        {errors.telefone && (
          <p className={errorClass}>{errors.telefone.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="cpf" className={labelClass}>
          CPF
        </label>
        <input id="cpf" type="text" className={inputClass} {...register("cpf")} />
        {errors.cpf && <p className={errorClass}>{errors.cpf.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="endereco" className={labelClass}>
          Endereço
        </label>
        <input
          id="endereco"
          type="text"
          className={inputClass}
          {...register("endereco")}
        />
        {errors.endereco && (
          <p className={errorClass}>{errors.endereco.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <FormButton type="submit" variant="primary" disabled={isSubmitting}>
          {initialData ? "Salvar edição" : "Criar cliente"}
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
