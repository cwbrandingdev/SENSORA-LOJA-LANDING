"use client";

// Portado de frontend/app/login/page.js — mesmo comportamento, tipado.
// Usa FormButton (não Button) porque o submit precisa de type="submit" e
// disabled — Button.tsx da Landing é só wrapper de next/link.
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAxiosError } from "axios";
import { login } from "@/services/auth";
import { setToken } from "@/lib/storage";
import { decodeToken } from "@/lib/jwt";
import { isDestinoInternoValido } from "@/lib/auth-redirect";
import { ROUTES } from "@/lib/routes";
import { useAuth } from "@/context/AuthContext";
import { PerfilUsuario } from "@/lib/types/loja";
import FormButton from "@/components/ui/FormButton";
import Logo from "@/components/ui/Logo";

const loginSchema = z.object({
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  senha: z
    .string()
    .min(1, "Senha é obrigatória")
    .min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

export default function LoginPage() {
  return (
    // useSearchParams() exige um limite de Suspense (Next.js App Router) —
    // sem isso, a página inteira perderia a otimização estática por causa
    // de um único parâmetro (?redirect=) que só o formulário precisa ler.
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login: markAuthenticated } = useAuth();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormValues) {
    setServerError("");

    try {
      const { access_token } = await login(data);
      setToken(access_token);
      markAuthenticated();

      // Task 7: se veio de um fluxo protegido (ex.: /loja/checkout), volta
      // exatamente para lá em vez do destino padrão por perfil — só quando
      // o parâmetro é um caminho interno de verdade (isDestinoInternoValido
      // recusa URL absoluta e "//host", que abririam um open redirect via
      // ?redirect=). Sem esse parâmetro, comportamento idêntico ao anterior.
      const redirectParam = searchParams.get("redirect");
      if (isDestinoInternoValido(redirectParam)) {
        router.push(redirectParam);
        return;
      }

      // Decodifica o token recém-recebido (em vez de ler `perfil` do
      // AuthContext) porque a atualização do context só se reflete no
      // próximo render — decidir o destino aqui evita depender desse
      // timing. CLIENTE vai para a loja; qualquer outro perfil (ADMIN,
      // VENDEDOR) vai para o Admin, onde o ProtectedLayout é quem valida
      // de fato o acesso.
      const perfil = decodeToken(access_token)?.perfil;
      router.push(perfil === PerfilUsuario.CLIENTE ? ROUTES.LOJA : ROUTES.DASHBOARD);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
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
          <Logo showTagline={false} />
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

          <FormButton type="submit" variant="primary" disabled={isSubmitting}>
            Entrar
          </FormButton>
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
