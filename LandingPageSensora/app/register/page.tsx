"use client";

// Portado de frontend/app/register/page.js — mesmo comportamento, tipado.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { register as registerUser } from "@/services/auth";
import { ROUTES } from "@/lib/routes";
import FormButton from "@/components/ui/FormButton";
import Logo from "@/components/ui/Logo";

const registerSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  senha: z
    .string()
    .min(1, "Senha é obrigatória")
    .min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterFormValues) {
    setServerError("");

    try {
      await registerUser(data);
      setSuccess(true);
      setTimeout(() => {
        router.push(ROUTES.LOGIN);
      }, 1000);
    } catch {
      setServerError("Não foi possível criar a conta.");
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <Logo showTagline={false} />
          <h1 className="text-lg font-semibold text-brand-navy">Criar conta</h1>
        </div>

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
              Senha
            </label>
            <input
              id="senha"
              type="password"
              className={inputClass}
              {...register("senha")}
            />
            {errors.senha && <p className={errorClass}>{errors.senha.message}</p>}
          </div>

          {serverError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          )}

          {success && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Conta criada! Redirecionando para o login...
            </p>
          )}

          <FormButton type="submit" variant="primary" disabled={isSubmitting}>
            Criar conta
          </FormButton>
        </form>

        <p className="text-center text-sm text-slate-600">
          Já tem conta?{" "}
          <Link href={ROUTES.LOGIN} className="font-medium text-brand-navy hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
