"use client";

// Etapa 3 (Minha Conta / Segurança) — POST /auth/change-password
// (services/conta.ts, endpoint inalterado). Usuário identificado só por
// @CurrentUser() (JWT) no backend — nunca por um id enviado daqui.
// `confirmarNovaSenha` é validação só do frontend (nunca enviada ao
// backend). Refresh tokens anteriores são revogados pelo backend (Task 27) —
// o access token atual continua válido até expirar naturalmente, mesmo
// comportamento já existente no reset de senha por e-mail; por isso não
// forçamos logout aqui.
//
// Ajuste de UX (revisão pós-Etapa 3): por padrão a seção só mostra
// "Senha ••••••••" com uma ação "Alterar senha" — o formulário só aparece
// depois desse clique, e "Cancelar" fecha sem salvar nada. Nunca exibimos a
// senha real nem o hash em nenhum momento, nem antes nem depois da troca.
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import FormButton from "@/components/ui/FormButton";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { alterarMinhaSenha } from "@/services/conta";

const senhaSchema = z
  .object({
    senhaAtual: z.string().min(1, "Senha atual é obrigatória"),
    novaSenha: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres"),
    confirmarNovaSenha: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((data) => data.novaSenha === data.confirmarNovaSenha, {
    message: "As senhas não coincidem",
    path: ["confirmarNovaSenha"],
  });

type SenhaFormValues = z.infer<typeof senhaSchema>;

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

export default function SegurancaPage() {
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SenhaFormValues>({
    resolver: zodResolver(senhaSchema),
    defaultValues: { senhaAtual: "", novaSenha: "", confirmarNovaSenha: "" },
  });

  function iniciarEdicao() {
    setServerError("");
    reset();
    setEditando(true);
  }

  function cancelarEdicao() {
    setServerError("");
    reset();
    setEditando(false);
  }

  async function onSubmit(data: SenhaFormValues) {
    setServerError("");
    try {
      await alterarMinhaSenha({
        senhaAtual: data.senhaAtual,
        novaSenha: data.novaSenha,
      });
      reset();
      setEditando(false);
      toast.success("Senha alterada com sucesso.");
    } catch (err) {
      setServerError(getErrorMessage(err, "Não foi possível alterar sua senha."));
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pt-28 pb-24 sm:pt-36 sm:pb-32 lg:px-10">
      <RevealOnScroll>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Minha Conta
        </p>
        <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
          Segurança
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
          Gerencie a senha de acesso à sua conta.
        </p>
      </RevealOnScroll>

      <RevealOnScroll delayMs={90}>
        <div className="mt-10 rounded-sm border border-slate-200 bg-white p-6">
          {!editando ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Senha
                </p>
                <p aria-hidden className="mt-1 text-base tracking-widest text-brand-navy">
                  ••••••••
                </p>
                <span className="sr-only">Senha oculta por segurança</span>
              </div>
              <FormButton
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={iniciarEdicao}
              >
                Alterar senha
              </FormButton>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="senhaAtual" className={labelClass}>
                  Senha atual
                </label>
                <input
                  id="senhaAtual"
                  type="password"
                  autoFocus
                  className={inputClass}
                  {...register("senhaAtual")}
                />
                {errors.senhaAtual && <p className={errorClass}>{errors.senhaAtual.message}</p>}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="novaSenha" className={labelClass}>
                  Nova senha
                </label>
                <input
                  id="novaSenha"
                  type="password"
                  className={inputClass}
                  {...register("novaSenha")}
                />
                {errors.novaSenha && <p className={errorClass}>{errors.novaSenha.message}</p>}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="confirmarNovaSenha" className={labelClass}>
                  Confirmar nova senha
                </label>
                <input
                  id="confirmarNovaSenha"
                  type="password"
                  className={inputClass}
                  {...register("confirmarNovaSenha")}
                />
                {errors.confirmarNovaSenha && (
                  <p className={errorClass}>{errors.confirmarNovaSenha.message}</p>
                )}
              </div>

              {serverError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {serverError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <FormButton type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Salvar"}
                </FormButton>
                <FormButton
                  type="button"
                  variant="ghost"
                  onClick={cancelarEdicao}
                  disabled={isSubmitting}
                >
                  Cancelar
                </FormButton>
              </div>
            </form>
          )}
        </div>
      </RevealOnScroll>
    </div>
  );
}
