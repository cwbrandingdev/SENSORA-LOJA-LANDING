"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { login } from "@/services/auth";
import { setToken } from "@/lib/storage";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";
import Logo from "@/components/ui/Logo";

const loginSchema = z.object({
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  senha: z
    .string()
    .min(1, "Senha é obrigatória")
    .min(6, "A senha deve ter no mínimo 6 caracteres"),
});

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

export default function LoginPage() {
  const router = useRouter();
  const { login: markAuthenticated } = useAuth();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data) {
    setServerError("");

    try {
      const { access_token } = await login(data);
      setToken(access_token);
      markAuthenticated();
      router.push(ROUTES.DASHBOARD);
    } catch (error) {
      if (error.response?.status === 401) {
        setServerError("E-mail ou senha inválidos.");
      } else {
        setServerError("Não foi possível conectar ao servidor.");
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <Logo className="h-12 w-auto" />
          <h1 className="text-lg font-semibold text-brand-navy">Login</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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

          <Button type="submit" variant="primary" disabled={isSubmitting}>
            Entrar
          </Button>
        </form>

        <p className="text-center text-sm text-slate-600">
          Não tem conta?{" "}
          <Link href={ROUTES.REGISTER} className="font-medium text-brand-navy hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
