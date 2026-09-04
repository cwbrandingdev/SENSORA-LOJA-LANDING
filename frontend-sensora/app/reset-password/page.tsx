"use client";

// Etapa 8.0 (Finalização do e-mail/Resend) — página alcançada pelo link
// enviado por e-mail em AuthService.enviarEmailResetSenha (backend), que
// monta exatamente `${FRONTEND_URL}/reset-password?token=...`. Não existia
// página nenhuma nesta rota antes desta etapa (achado da auditoria — o
// e-mail de recuperação de senha apontava para um link morto, apesar do
// backend já ter POST /auth/reset-password funcionando). Mesmo padrão de
// validação de senha (min 8 + confirmação) já usado em
// app/(site)/conta/seguranca/page.tsx — nenhuma regra nova inventada aqui,
// só espelha ResetPasswordDto (backend/src/auth/dto/reset-password.dto.ts).
// O token nunca autentica (mesmo raciocínio de verify-email): sucesso só
// leva de volta para /login, nunca loga o usuário automaticamente.
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { resetPassword } from "@/services/auth";
import { getErrorMessage } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import FormButton from "@/components/ui/FormButton";
import Logo from "@/components/ui/Logo";

const senhaSchema = z
  .object({
    novaSenha: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres"),
    confirmarNovaSenha: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((data) => data.novaSenha === data.confirmarNovaSenha, {
    message: "As senhas não coincidem",
    path: ["confirmarNovaSenha"],
  });

type SenhaFormValues = z.infer<typeof senhaSchema>;

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm transition-colors duration-200 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

function CampoSenha({
  id,
  label,
  autoFocus,
  register,
  erro,
}: {
  id: "novaSenha" | "confirmarNovaSenha";
  label: string;
  autoFocus?: boolean;
  register: ReturnType<typeof useForm<SenhaFormValues>>["register"];
  erro?: string;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="flex flex-col gap-1 text-left">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visivel ? "text" : "password"}
          autoFocus={autoFocus}
          className={inputClass}
          {...register(id)}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition-colors duration-200 hover:text-brand-navy focus-visible:text-brand-navy focus-visible:outline-none"
        >
          {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {erro && <p className={errorClass}>{erro}</p>}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [sucesso, setSucesso] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SenhaFormValues>({
    resolver: zodResolver(senhaSchema),
    defaultValues: { novaSenha: "", confirmarNovaSenha: "" },
  });

  async function onSubmit(data: SenhaFormValues) {
    if (!token) return;
    setServerError("");

    try {
      await resetPassword({ token, novaSenha: data.novaSenha });
      setSucesso(true);
    } catch (err) {
      setServerError(
        getErrorMessage(err, "Não foi possível redefinir sua senha. Tente novamente."),
      );
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
              Este link de redefinição está incompleto. Verifique se copiou o
              endereço completo do e-mail, ou solicite um novo.
            </p>
            <Link
              href={ROUTES.FORGOT_PASSWORD}
              className="inline-flex w-full items-center justify-center rounded-md bg-brand-navy px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-navy-light"
            >
              Solicitar novo link
            </Link>
          </>
        ) : sucesso ? (
          <>
            <h1 className="text-lg font-semibold text-brand-navy">Senha redefinida</h1>
            <p role="status" className="text-sm text-slate-600">
              Sua senha foi redefinida com sucesso. Faça login com a nova senha.
            </p>
            <Link
              href={ROUTES.LOGIN}
              className="inline-flex w-full items-center justify-center rounded-md bg-brand-navy px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-navy-light"
            >
              Ir para o login
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-brand-navy">Redefinir senha</h1>
            <p className="text-sm text-slate-600">Escolha uma nova senha para sua conta.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="flex w-full flex-col gap-4">
              <CampoSenha
                id="novaSenha"
                label="Nova senha"
                autoFocus
                register={register}
                erro={errors.novaSenha?.message}
              />
              <CampoSenha
                id="confirmarNovaSenha"
                label="Confirmar nova senha"
                register={register}
                erro={errors.confirmarNovaSenha?.message}
              />

              {serverError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {serverError}
                </p>
              )}

              <FormButton type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Redefinir senha"}
              </FormButton>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
