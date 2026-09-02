"use client";

// Etapa 6.4 (Confirmação de e-mail) — página alcançada pelo link enviado por
// e-mail após o cadastro (ver AuthService.enviarEmailVerificacao, backend).
// Decisão de segurança aprovada: a confirmação NUNCA dispara sozinha ao
// carregar a página — só quando o usuário clica manualmente no botão. Sem
// isso, scanners de segurança corporativos (que "abrem" links de e-mail
// automaticamente para varrer malware) queimariam o token de uso único
// antes do usuário de verdade abrir o e-mail.
import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import { verifyEmail, resendVerification } from "@/services/auth";
import { getErrorMessage } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import FormButton from "@/components/ui/FormButton";
import Logo from "@/components/ui/Logo";

type Estado = "idle" | "confirmando" | "sucesso" | "erro";

export default function ConfirmarEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmarEmailContent />
    </Suspense>
  );
}

function ConfirmarEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [estado, setEstado] = useState<Estado>("idle");
  const [mensagem, setMensagem] = useState("");

  async function handleConfirmar() {
    if (!token) return;
    setEstado("confirmando");

    try {
      const resposta = await verifyEmail({ token });
      setMensagem(resposta.message);
      setEstado("sucesso");
    } catch (error) {
      setMensagem(
        getErrorMessage(error, "Não foi possível confirmar seu e-mail. Tente novamente."),
      );
      setEstado("erro");
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Logo variant="dark" showTagline={false} />

        {!token ? (
          <>
            <h1 className="text-lg font-semibold text-brand-navy">Link inválido</h1>
            <p className="text-sm text-slate-600">
              Este link de confirmação está incompleto. Verifique se copiou o
              endereço completo do e-mail, ou solicite um novo abaixo.
            </p>
            <ReenviarConfirmacao />
          </>
        ) : estado === "sucesso" ? (
          <>
            <h1 className="text-lg font-semibold text-brand-navy">E-mail confirmado</h1>
            <p role="status" className="text-sm text-slate-600">
              {mensagem}
            </p>
            <Link
              href={ROUTES.LOGIN}
              className="inline-flex w-full items-center justify-center rounded-md bg-brand-navy px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-navy-light"
            >
              Ir para o login
            </Link>
          </>
        ) : estado === "erro" ? (
          <>
            <h1 className="text-lg font-semibold text-brand-navy">
              Não foi possível confirmar
            </h1>
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {mensagem}
            </p>
            <p className="text-sm text-slate-600">
              O link pode ter expirado ou já ter sido usado. Solicite um novo
              abaixo.
            </p>
            <ReenviarConfirmacao />
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-brand-navy">Confirme seu e-mail</h1>
            <p className="text-sm text-slate-600">
              Clique no botão abaixo para confirmar seu endereço de e-mail e
              ativar sua conta.
            </p>
            <FormButton
              type="button"
              variant="primary"
              className="w-full"
              disabled={estado === "confirmando"}
              onClick={handleConfirmar}
            >
              {estado === "confirmando" ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  Confirmando...
                </span>
              ) : (
                "Confirmar meu e-mail"
              )}
            </FormButton>
          </>
        )}
      </div>
    </div>
  );
}

// Formulário de reenvio — próprio e-mail digitado aqui (não assume que
// sabemos qual é: um token inválido/expirado não revela de quem ele era).
// Mesma resposta genérica sempre (backend nunca confirma se o e-mail existe
// ou já está confirmado — ver AuthService.resendVerification).
function ReenviarConfirmacao() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email || enviando) return;
    setEnviando(true);
    setErro("");

    try {
      await resendVerification({ email });
      setEnviado(true);
    } catch (error) {
      setErro(
        isAxiosError(error)
          ? getErrorMessage(error, "Não foi possível enviar o e-mail. Tente novamente.")
          : "Não foi possível conectar ao servidor.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
        Se esse e-mail existir e ainda não estiver confirmado, você receberá um
        novo link em instantes.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <label htmlFor="reenvio-email" className="sr-only">
        Email
      </label>
      <input
        id="reenvio-email"
        type="email"
        required
        placeholder="Seu e-mail"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <FormButton type="submit" variant="secondary" disabled={enviando} className="w-full">
        {enviando ? "Enviando..." : "Reenviar e-mail de confirmação"}
      </FormButton>
    </form>
  );
}
