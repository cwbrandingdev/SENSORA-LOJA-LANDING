"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Button from "@/components/ui/Button";

function toDefaultValues(usuario) {
  return {
    nome: usuario?.nome ?? "",
    email: usuario?.email ?? "",
    senha: "",
    perfil: usuario?.perfil ?? "CLIENTE",
    ativo: usuario?.ativo ?? true,
  };
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

export default function UserForm({ initialData, onSubmit, onCancel }) {
  const isEditing = Boolean(initialData);

  const userSchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório"),
    email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
    senha: isEditing
      ? z.union([
          z.literal(""),
          z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
        ])
      : z
          .string()
          .min(1, "Senha é obrigatória")
          .min(6, "A senha deve ter no mínimo 6 caracteres"),
    perfil: z.enum(["ADMIN", "VENDEDOR", "CLIENTE"]),
    ativo: z.boolean(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(userSchema),
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
        <label htmlFor="senha" className={labelClass}>
          Senha{isEditing && " (deixe em branco para manter a atual)"}
        </label>
        <input
          id="senha"
          type="password"
          className={inputClass}
          {...register("senha")}
        />
        {errors.senha && <p className={errorClass}>{errors.senha.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="perfil" className={labelClass}>
          Perfil
        </label>
        <select id="perfil" className={inputClass} {...register("perfil")}>
          <option value="ADMIN">Admin</option>
          <option value="VENDEDOR">Vendedor</option>
          <option value="CLIENTE">Cliente</option>
        </select>
        {errors.perfil && <p className={errorClass}>{errors.perfil.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input
          id="ativo"
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-navy focus:ring-1 focus:ring-brand-navy"
          {...register("ativo")}
        />
        <label htmlFor="ativo" className={labelClass}>
          Ativo
        </label>
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
              : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}
