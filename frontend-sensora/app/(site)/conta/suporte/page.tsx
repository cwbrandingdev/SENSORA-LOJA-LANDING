"use client";

// Suporte ao cliente — POST /suporte (services/suporte.ts). Protegida pelo
// layout de /conta (visitante vai ao login e volta para cá). O backend
// identifica o cliente só pelo token e pelo cadastro: daqui saem apenas
// assunto e mensagem, nunca nome, e-mail ou usuário. A resposta chega por
// e-mail, no endereço da conta.
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAxiosError } from "axios";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import FormButton from "@/components/ui/FormButton";
import AccountPageHeader from "@/components/conta/AccountPageHeader";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { decodeToken } from "@/lib/jwt";
import { getToken } from "@/lib/storage";
import { ROUTES } from "@/lib/routes";
import {
  PerfilUsuario,
  ROTULOS_CATEGORIA_SUPORTE,
  type CategoriaSuporte,
} from "@/lib/types/loja";
import { criarSolicitacaoSuporte } from "@/services/suporte";

// Mesmos limites do backend (CreateSolicitacaoSuporteDto).
const MAXIMO_ASSUNTO = 150;
const MAXIMO_MENSAGEM = 5000;

const CATEGORIAS = Object.keys(ROTULOS_CATEGORIA_SUPORTE) as CategoriaSuporte[];

const suporteSchema = z.object({
  // "" é o "Selecione..." inicial: obriga o cliente a escolher.
  categoria: z
    .string()
    .refine((valor) => CATEGORIAS.includes(valor as CategoriaSuporte), "Escolha do que se trata"),
  assunto: z
    .string()
    .trim()
    .min(1, "Informe o assunto")
    .max(MAXIMO_ASSUNTO, `O assunto pode ter até ${MAXIMO_ASSUNTO} caracteres`),
  mensagem: z
    .string()
    .trim()
    .min(1, "Escreva a mensagem")
    .max(MAXIMO_MENSAGEM, `A mensagem pode ter até ${MAXIMO_MENSAGEM} caracteres`),
});

type SuporteFormValues = z.infer<typeof suporteSchema>;

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-colors duration-200 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

export default function SuportePage() {
  const toast = useToast();
  const { perfil } = useAuth();
  const [serverError, setServerError] = useState("");
  const [enviada, setEnviada] = useState<number | null>(null);
  // E-mail da conta, só para dizer ao cliente para onde vai a resposta.
  const [emailConta] = useState(() => decodeToken(getToken())?.email ?? null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SuporteFormValues>({
    resolver: zodResolver(suporteSchema),
    defaultValues: { categoria: "", assunto: "", mensagem: "" },
  });

  const tamanhoMensagem = watch("mensagem").length;

  async function onSubmit(data: SuporteFormValues) {
    setServerError("");
    try {
      const solicitacao = await criarSolicitacaoSuporte({
        ...data,
        categoria: data.categoria as CategoriaSuporte,
      });
      reset();
      setEnviada(solicitacao.id);
      toast.success("Solicitação enviada.");
    } catch (err) {
      setServerError(
        isAxiosError(err) && err.response?.status === 429
          ? "Você enviou várias solicitações em pouco tempo. Aguarde um pouco e tente de novo."
          : getErrorMessage(err, "Não foi possível enviar sua solicitação."),
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pt-8 pb-24 sm:pb-32 lg:px-10">
      <AccountPageHeader
        backHref={ROUTES.CONTA}
        backLabel="Voltar para Minha Conta"
        title="Suporte"
        description="Conte para a gente como podemos ajudar. A resposta chega por e-mail, no endereço da sua conta."
      />

      <RevealOnScroll delayMs={90}>
        <div className="mt-10 rounded-sm border border-slate-200 bg-white p-6 transition-colors duration-300">
          {perfil !== PerfilUsuario.CLIENTE ? (
            <p className="text-sm text-slate-600">
              O formulário de suporte é para contas de cliente.
            </p>
          ) : enviada !== null ? (
            <div role="status" className="flex flex-col gap-4">
              <p className="text-base font-medium text-brand-navy">
                Recebemos sua solicitação nº {enviada}.
              </p>
              <p className="text-sm leading-relaxed text-slate-600">
                Vamos responder por e-mail
                {emailConta ? (
                  <>
                    {" "}
                    em <strong className="font-medium">{emailConta}</strong>
                  </>
                ) : null}
                . Fique de olho também na caixa de spam.
              </p>
              <div>
                <FormButton type="button" variant="secondary" onClick={() => setEnviada(null)}>
                  Enviar outra solicitação
                </FormButton>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1">
                <label htmlFor="categoria" className={labelClass}>
                  Do que se trata?
                </label>
                <select
                  id="categoria"
                  aria-invalid={errors.categoria ? true : undefined}
                  aria-describedby={errors.categoria ? "categoria-erro" : undefined}
                  className={inputClass}
                  {...register("categoria")}
                >
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {CATEGORIAS.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {ROTULOS_CATEGORIA_SUPORTE[categoria]}
                    </option>
                  ))}
                </select>
                {errors.categoria && (
                  <p id="categoria-erro" className={errorClass}>
                    {errors.categoria.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="assunto" className={labelClass}>
                  Assunto
                </label>
                <input
                  id="assunto"
                  type="text"
                  maxLength={MAXIMO_ASSUNTO}
                  aria-invalid={errors.assunto ? true : undefined}
                  aria-describedby={errors.assunto ? "assunto-erro" : undefined}
                  className={inputClass}
                  {...register("assunto")}
                />
                {errors.assunto && (
                  <p id="assunto-erro" className={errorClass}>
                    {errors.assunto.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="mensagem" className={labelClass}>
                  Mensagem
                </label>
                <textarea
                  id="mensagem"
                  rows={8}
                  maxLength={MAXIMO_MENSAGEM}
                  aria-invalid={errors.mensagem ? true : undefined}
                  aria-describedby={errors.mensagem ? "mensagem-erro mensagem-contador" : "mensagem-contador"}
                  className={`${inputClass} resize-y`}
                  {...register("mensagem")}
                />
                <div className="flex justify-between gap-4">
                  {errors.mensagem ? (
                    <p id="mensagem-erro" className={errorClass}>
                      {errors.mensagem.message}
                    </p>
                  ) : (
                    <span />
                  )}
                  <p id="mensagem-contador" className="text-xs text-slate-500">
                    {tamanhoMensagem}/{MAXIMO_MENSAGEM}
                  </p>
                </div>
              </div>

              {serverError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {serverError}
                </p>
              )}

              <div className="pt-2">
                <FormButton type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando..." : "Enviar solicitação"}
                </FormButton>
              </div>
            </form>
          )}
        </div>
      </RevealOnScroll>
    </div>
  );
}
