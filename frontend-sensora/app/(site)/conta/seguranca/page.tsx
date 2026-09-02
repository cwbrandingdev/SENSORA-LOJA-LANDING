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
import { Eye, EyeOff } from "lucide-react";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import FormButton from "@/components/ui/FormButton";
import AccountPageHeader from "@/components/conta/AccountPageHeader";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { alterarMinhaSenha } from "@/services/conta";
import { ROUTES } from "@/lib/routes";

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
  "w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm transition-colors duration-200 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

// Etapa 6.1 (Refinamento) — nenhum dos 3 campos de senha tinha
// mostrar/ocultar (auditoria, item 9 da etapa). Um botão só de ícone dentro
// do próprio input, nunca alterando o `name`/contrato do formulário —
// react-hook-form continua registrando o campo como senha normalmente, só
// o atributo `type` alterna entre "password"/"text".
function CampoSenha({
  id,
  label,
  autoFocus,
  register,
  erro,
}: {
  id: "senhaAtual" | "novaSenha" | "confirmarNovaSenha";
  label: string;
  autoFocus?: boolean;
  register: ReturnType<typeof useForm<SenhaFormValues>>["register"];
  erro?: string;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="flex flex-col gap-1">
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
      <AccountPageHeader
        backHref={ROUTES.CONTA}
        backLabel="Voltar para Minha Conta"
        title="Segurança"
        description="Gerencie a senha de acesso à sua conta."
      />

      <RevealOnScroll delayMs={90}>
        <div className="mt-10 rounded-sm border border-slate-200 bg-white p-6 transition-colors duration-300">
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
              <CampoSenha
                id="senhaAtual"
                label="Senha atual"
                autoFocus
                register={register}
                erro={errors.senhaAtual?.message}
              />
              <CampoSenha
                id="novaSenha"
                label="Nova senha"
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
