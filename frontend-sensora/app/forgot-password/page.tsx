"use client";

// Etapa 8.0 (Finalização do e-mail/Resend) — página alcançada pelo link
// "Esqueci minha senha" (components/auth/AuthSwitch.tsx -> ROUTES.FORGOT_PASSWORD).
// Não existia página nenhuma nesta rota antes desta etapa (achado da
// auditoria — link morto). Mesmo padrão anti-enumeração de
// ReenviarConfirmacao (app/confirmar-email/page.tsx): a mensagem de sucesso
// é sempre a mesma genérica devolvida pelo backend
// (AuthService.forgotPassword), independente de o e-mail existir ou não —
// só uma falha real de rede/servidor é distinguida do sucesso.
import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { forgotPassword } from "@/services/auth";
import { getErrorMessage } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import FormButton from "@/components/ui/FormButton";
import Logo from "@/components/ui/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email || enviando) return;

    setEnviando(true);
    setErro("");

    try {
      const resposta = await forgotPassword({ email });
      setMensagem(resposta.message);
      setEnviado(true);
    } catch (error) {
      setErro(
        getErrorMessage(error, "Não foi possível enviar o e-mail. Tente novamente."),
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Logo variant="dark" showTagline={false} />

        {enviado ? (
          <>
            <h1 className="text-lg font-semibold text-brand-navy">Verifique seu e-mail</h1>
            <p role="status" className="text-sm text-slate-600">
              {mensagem}
            </p>
            <Link
              href={ROUTES.LOGIN}
              className="inline-flex w-full items-center justify-center rounded-md bg-brand-navy px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-navy-light"
            >
              Voltar para o login
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-brand-navy">Esqueci minha senha</h1>
            <p className="text-sm text-slate-600">
              Informe seu e-mail cadastrado. Se ele existir, enviaremos um
              link para você redefinir sua senha.
            </p>

            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
              <label htmlFor="forgot-email" className="sr-only">
                E-mail
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                autoFocus
                placeholder="Seu e-mail"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
              />
              {erro && (
                <p role="alert" className="text-sm text-red-600">
                  {erro}
                </p>
              )}
              <FormButton
                type="submit"
                variant="primary"
                className="w-full"
                disabled={enviando}
              >
                {enviando ? "Enviando..." : "Enviar link de redefinição"}
              </FormButton>
            </form>

            <Link
              href={ROUTES.LOGIN}
              className="text-sm font-medium text-brand-navy hover:underline"
            >
              Voltar para o login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
