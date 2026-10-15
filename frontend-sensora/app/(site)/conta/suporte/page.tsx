"use client";

// Suporte ao cliente — POST /suporte (services/suporte.ts). Protegida pelo
// layout de /conta (visitante vai ao login e volta para cá). O backend
// identifica o cliente só pelo token e pelo cadastro: daqui saem apenas
// categoria, assunto e mensagem, nunca nome, e-mail ou usuário. A resposta
// chega por e-mail, no endereço da conta.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  CreditCard,
  Package,
  Truck,
  Undo2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import StatusSuporteBadge, { formatarDataSuporte } from "@/components/admin/StatusSuporteBadge";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import FormButton from "@/components/ui/FormButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ROTAS_LEGAIS } from "@/lib/empresa";
import { getErrorMessage } from "@/lib/errors";
import { decodeToken } from "@/lib/jwt";
import { getToken } from "@/lib/storage";
import { ROUTES } from "@/lib/routes";
import {
  PerfilUsuario,
  ROTULOS_CATEGORIA_SUPORTE,
  type CategoriaSuporte,
  type SolicitacaoSuporteDoCliente,
} from "@/lib/types/loja";
import { cn } from "@/lib/utils";
import { criarSolicitacaoSuporte, listarMeusChamadosSuporte } from "@/services/suporte";

// Mesmos limites do backend (CreateSolicitacaoSuporteDto).
const MAXIMO_ASSUNTO = 150;
const MAXIMO_MENSAGEM = 5000;

const CATEGORIAS = Object.keys(ROTULOS_CATEGORIA_SUPORTE) as CategoriaSuporte[];

const ICONE_CATEGORIA: Record<CategoriaSuporte, LucideIcon> = {
  PRODUTO: Package,
  PEDIDO_ENTREGA: Truck,
  TROCA_DEVOLUCAO: Undo2,
  PAGAMENTO: CreditCard,
  CONTA: UserRound,
  OUTRO: CircleHelp,
};

// O que entra em cada categoria, para ajudar o cliente a escolher.
const DESCRICAO_CATEGORIA: Record<CategoriaSuporte, string> = {
  PRODUTO: "Aromas, uso, composição, cuidados",
  PEDIDO_ENTREGA: "Prazo, rastreio, atraso, endereço",
  TROCA_DEVOLUCAO: "Desistência, defeito, produto errado",
  PAGAMENTO: "Cobrança, Pix, cartão, estorno",
  CONTA: "Login, senha, dados pessoais",
  OUTRO: "Qualquer outro assunto",
};

const suporteSchema = z.object({
  // Nenhuma aba escolhida chega como "" ou null (rádio sem marcação): os
  // dois casos mostram a mesma mensagem, nunca o "Invalid input" padrão.
  categoria: z
    .string({ error: "Escolha uma categoria, por favor." })
    .refine((valor) => CATEGORIAS.includes(valor as CategoriaSuporte), "Escolha uma categoria, por favor."),
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
const sombraCartao = "shadow-[0_30px_60px_-30px_rgba(15,23,42,0.45)]";

// "Antes de escrever": atalhos para o que costuma resolver sem abrir uma
// solicitação, e dicas para a mensagem.
function PainelAjuda() {
  const atalhos: { href: string; titulo: string; texto: string; icone: LucideIcon }[] = [
    { href: ROUTES.CONTA_PEDIDOS, titulo: "Meus pedidos", texto: "Status e rastreio de cada pedido.", icone: Truck },
    { href: ROTAS_LEGAIS.trocas, titulo: "Trocas e devoluções", texto: "Prazos e como pedir.", icone: Undo2 },
    { href: "/faq", titulo: "Perguntas frequentes", texto: "Respostas rápidas.", icone: CircleHelp },
  ];
  return (
    <aside className={cn("flex flex-col gap-5 rounded-sm bg-white p-6", sombraCartao)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">Antes de escrever</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Talvez a resposta já esteja por aqui:</p>
      </div>
      <ul className="flex flex-col divide-y divide-stone-100 border-y border-stone-100">
        {atalhos.map((a) => {
          const Icone = a.icone;
          return (
            <li key={a.href}>
              <Link href={a.href} className="group flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
                  <Icone aria-hidden className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-brand-navy group-hover:underline">{a.titulo}</span>
                  <span className="block text-xs text-slate-500">{a.texto}</span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-orange"
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="text-sm leading-relaxed text-slate-600">
        <p className="font-medium text-brand-navy">Dicas para agilizar</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Informe o número do pedido, se houver.</li>
          <li>Descreva o que aconteceu e o que você espera.</li>
        </ul>
      </div>
    </aside>
  );
}

// Situação de cada solicitação do cliente (GET /suporte). `versao` muda a
// cada envio, para a lista recarregar já com a nova. Sem solicitações (ou
// se a lista falhar), o bloco não aparece.
function SuasSolicitacoes({ versao }: { versao: number | null }) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoSuporteDoCliente[]>([]);

  useEffect(() => {
    let ativo = true;
    listarMeusChamadosSuporte()
      .then((lista) => ativo && setSolicitacoes(lista))
      .catch(() => ativo && setSolicitacoes([]));
    return () => {
      ativo = false;
    };
  }, [versao]);

  if (solicitacoes.length === 0) return null;
  const emAberto = solicitacoes.filter((s) => s.status !== "RESOLVIDA").length;

  return (
    <section aria-labelledby="suas-solicitacoes" className={cn("rounded-sm bg-white", sombraCartao)}>
      <div className="flex items-baseline justify-between gap-4 border-b border-slate-200 px-6 py-4 sm:px-8">
        <h2 id="suas-solicitacoes" className="font-serif text-xl text-brand-navy">
          Suas solicitações
        </h2>
        <p className="text-sm text-slate-500">{emAberto === 0 ? "Nenhuma em aberto" : `${emAberto} em aberto`}</p>
      </div>
      <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
        {solicitacoes.map((s) => (
          <li key={s.id} className="flex items-center gap-4 px-6 py-3 sm:px-8">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-brand-navy">
                Nº {s.id} · {s.assunto}
              </p>
              <p className="text-xs text-slate-500">
                {ROTULOS_CATEGORIA_SUPORTE[s.categoria]} · aberta em {formatarDataSuporte(s.criadaEm)}
              </p>
            </div>
            <StatusSuporteBadge status={s.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

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

  const escolhida = watch("categoria");
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
    <div className="pb-24 sm:pb-32">
      {/* No desktop o espaço reservado à navbar (--navbar-height) é maior
          que a barra (h-18): sobe a faixa essa diferença para não sobrar
          uma tira clara entre a navbar e o azul. */}
      <div className="bg-brand-navy px-6 pt-10 pb-40 text-white lg:-mt-[calc(var(--navbar-height)-4.5rem)] lg:px-10 lg:pt-[calc(var(--navbar-height)-4.5rem+2.5rem)]">
        <div className="mx-auto max-w-6xl">
          <Link
            href={ROUTES.CONTA}
            className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-white/70 hover:text-white"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Voltar para Minha Conta
          </Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange-light">Suporte</p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Como podemos ajudar?</h1>
          <p className="mt-4 max-w-xl text-white/70">
            Conte o que aconteceu. A resposta chega por e-mail
            {emailConta ? (
              <>
                , em <strong className="font-medium text-white">{emailConta}</strong>
              </>
            ) : (
              ", no endereço da sua conta"
            )}
            .
          </p>
        </div>
      </div>

      <div className="-mt-28 px-6 lg:px-10">
        <RevealOnScroll delayMs={90}>
          {perfil === PerfilUsuario.CLIENTE && (
            <div className="mx-auto mb-6 max-w-6xl">
              <SuasSolicitacoes versao={enviada} />
            </div>
          )}
          <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className={cn("overflow-hidden rounded-sm bg-white", sombraCartao)}>
              {perfil !== PerfilUsuario.CLIENTE ? (
                <p className="p-8 text-sm text-slate-600">O formulário de suporte é para contas de cliente.</p>
              ) : enviada !== null ? (
                <div role="status" className="flex flex-col items-center gap-4 px-8 py-12 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CheckCircle2 aria-hidden className="h-7 w-7" />
                  </span>
                  <p className="font-serif text-2xl text-brand-navy">Recebemos sua solicitação nº {enviada}.</p>
                  <p className="max-w-md text-sm leading-relaxed text-slate-600">
                    Vamos responder por e-mail
                    {emailConta ? (
                      <>
                        {" "}
                        em <strong className="font-medium">{emailConta}</strong>
                      </>
                    ) : null}
                    . Fique de olho também na caixa de spam.
                  </p>
                  <FormButton type="button" variant="secondary" onClick={() => setEnviada(null)}>
                    Enviar outra solicitação
                  </FormButton>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                  <fieldset
                    aria-describedby="categoria-ajuda"
                    className="border-b border-slate-200 px-6 pt-6 pb-5 sm:px-8"
                  >
                    <legend className="float-left mb-3 w-full text-sm font-medium text-slate-700">
                      Do que se trata? <span className="text-brand-orange">*</span>
                    </legend>
                    <div className="clear-both grid gap-2 sm:grid-cols-2">
                      {CATEGORIAS.map((c) => {
                        const Icone = ICONE_CATEGORIA[c];
                        const ativa = escolhida === c;
                        return (
                          <label
                            key={c}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-navy",
                              ativa
                                ? "border-brand-orange bg-brand-orange/5"
                                : errors.categoria
                                  ? "border-red-300 hover:border-brand-navy"
                                  : "border-slate-200 hover:border-brand-navy",
                            )}
                          >
                            <input type="radio" value={c} className="sr-only" {...register("categoria")} />
                            <span
                              aria-hidden
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                                ativa ? "border-brand-orange" : "border-slate-300",
                              )}
                            >
                              {ativa && <span className="h-2 w-2 rounded-full bg-brand-orange" />}
                            </span>
                            <Icone
                              aria-hidden
                              className={cn("h-5 w-5 shrink-0", ativa ? "text-brand-orange" : "text-slate-400")}
                            />
                            <span className="min-w-0">
                              <span
                                className={cn("block text-sm", ativa ? "font-medium text-brand-navy" : "text-slate-700")}
                              >
                                {ROTULOS_CATEGORIA_SUPORTE[c]}
                              </span>
                              <span className="block text-xs text-slate-500">{DESCRICAO_CATEGORIA[c]}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {errors.categoria ? (
                      <p id="categoria-ajuda" role="alert" className={cn(errorClass, "mt-3")}>
                        {errors.categoria.message}
                      </p>
                    ) : (
                      !escolhida && (
                        <p id="categoria-ajuda" className="mt-3 text-sm text-slate-500">
                          Escolha uma opção para direcionarmos seu chamado.
                        </p>
                      )
                    )}
                  </fieldset>

                  <div className="flex flex-col gap-5 p-6 sm:p-8">
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

                    <div className="flex justify-end">
                      <FormButton type="submit" variant="primary" disabled={isSubmitting}>
                        {isSubmitting ? "Enviando..." : "Enviar solicitação"}
                      </FormButton>
                    </div>
                  </div>
                </form>
              )}
            </div>

            <PainelAjuda />
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
