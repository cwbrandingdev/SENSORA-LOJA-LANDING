"use client";

// Etapa 3 (Minha Conta / Dados Pessoais) — GET/PUT /usuarios/me
// (services/conta.ts). Ownership é resolvido inteiramente no backend via
// @CurrentUser() — nenhum id é enviado por esta página. AtualizarMeusDadosDto
// (backend) aceita nome/email/cpf/telefone — mesmo editando um campo por vez
// aqui, o submit sempre envia os quatro juntos (o campo não editado carrega
// o valor já carregado), nunca perfil/ativo/id.
//
// Ajuste de UX (revisão pós-Etapa 3): a página não abre mais direto num
// formulário — primeiro mostra nome/e-mail em modo de visualização, cada um
// com sua própria ação "Editar" independente. Só um campo fica editável por
// vez (abrir a edição de um campo descarta qualquer edição não salva do
// outro, via reset()). Depois de salvar, o valor exibido é atualizado
// imediatamente com a resposta do backend — mas o nome exibido no Navbar/
// saudação de /conta, derivado do e-mail do JWT, só reflete a mudança no
// próximo login (token imutável até expirar; reemitir token está fora do
// escopo desta etapa).
//
// Etapa "Dados do Cliente / Cadastro" — CPF e telefone entraram no mesmo
// padrão de card/Editar-Salvar-Cancelar acima, com o rótulo de ação trocado
// para "Adicionar" quando o campo ainda não foi preenchido (ver
// AÇÃO_CAMPO_VAZIO abaixo). Ambos opcionais: nunca bloqueiam o salvamento de
// nome/e-mail, e string vazia limpa o valor já salvo (mesmo contrato do
// backend, ver UsuariosService.atualizarMeusDados). A formatação
// (123.456.789-09 / (41) 99999-9999) é só apresentação, aplicada a cada
// tecla digitada (ver lib/cpf.ts e lib/telefone.ts) — o valor normalizado
// de verdade é sempre recalculado no backend antes de persistir.
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import FormButton from "@/components/ui/FormButton";
import Skeleton from "@/components/ui/Skeleton";
import AccountPageHeader from "@/components/conta/AccountPageHeader";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { atualizarMeuPerfil, buscarMeuPerfil } from "@/services/conta";
import { ROUTES } from "@/lib/routes";
import { cpfValido, formatarCpf } from "@/lib/cpf";
import { formatarTelefone, telefoneValido } from "@/lib/telefone";
import type { Usuario } from "@/lib/types/loja";

const dadosSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(150, "Nome muito longo"),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  // Opcionais: string vazia é um valor válido (significa "sem CPF/telefone
  // cadastrado" ou "remover o já cadastrado") — só valida de verdade quando
  // algo foi digitado.
  cpf: z
    .string()
    .refine((valor) => valor.trim() === "" || cpfValido(valor), {
      message: "CPF inválido",
    }),
  telefone: z
    .string()
    .refine((valor) => valor.trim() === "" || telefoneValido(valor), {
      message: "Telefone inválido",
    }),
});

type DadosFormValues = z.infer<typeof dadosSchema>;
type Campo = "nome" | "email" | "cpf" | "telefone";

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm transition-colors duration-200 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const errorClass = "text-sm text-red-600";

function valoresIniciais(usuario: Usuario): DadosFormValues {
  return {
    nome: usuario.nome,
    email: usuario.email,
    cpf: usuario.cpf ?? "",
    telefone: usuario.telefone ?? "",
  };
}

export default function DadosPessoaisPage() {
  const toast = useToast();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [campoEditando, setCampoEditando] = useState<Campo | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DadosFormValues>({
    resolver: zodResolver(dadosSchema),
    defaultValues: { nome: "", email: "", cpf: "", telefone: "" },
  });

  useEffect(() => {
    buscarMeuPerfil()
      .then((dados) => {
        setUsuario(dados);
        reset(valoresIniciais(dados));
      })
      .catch((err) => {
        toast.error(getErrorMessage(err, "Não foi possível carregar seus dados."));
      })
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function iniciarEdicao(campo: Campo) {
    if (usuario) reset(valoresIniciais(usuario));
    setCampoEditando(campo);
  }

  function cancelarEdicao() {
    if (usuario) reset(valoresIniciais(usuario));
    setCampoEditando(null);
  }

  async function onSubmit(data: DadosFormValues) {
    try {
      const atualizado = await atualizarMeuPerfil(data);
      setUsuario(atualizado);
      reset(valoresIniciais(atualizado));
      setCampoEditando(null);
      toast.success("Dados atualizados com sucesso.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível atualizar seus dados."));
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pt-28 pb-24 sm:pt-36 sm:pb-32 lg:px-10">
      <AccountPageHeader
        backHref={ROUTES.CONTA}
        backLabel="Voltar para Minha Conta"
        title="Dados pessoais"
        description="Veja e atualize seus dados de cadastro."
      />

      <RevealOnScroll delayMs={90}>
        {carregando || !usuario ? (
          <div className="mt-10 flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-[84px] rounded-sm" />
            <Skeleton className="h-[84px] rounded-sm" />
            <Skeleton className="h-[84px] rounded-sm" />
            <Skeleton className="h-[84px] rounded-sm" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-10 flex flex-col gap-4">
            {/* Nome */}
            <div className="rounded-sm border border-slate-200 bg-white p-6 transition-colors duration-300 focus-within:border-brand-navy/40">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Nome
                  </p>
                  {campoEditando === "nome" ? (
                    <div className="mt-2 flex flex-col gap-1">
                      <input
                        id="nome"
                        type="text"
                        autoFocus
                        className={inputClass}
                        {...register("nome")}
                      />
                      {errors.nome && <p className={errorClass}>{errors.nome.message}</p>}
                    </div>
                  ) : (
                    <p className="mt-1 truncate text-base text-brand-navy">{usuario.nome}</p>
                  )}
                </div>

                {campoEditando === "nome" ? (
                  <div className="flex shrink-0 gap-2">
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
                ) : (
                  <FormButton
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => iniciarEdicao("nome")}
                  >
                    Editar
                  </FormButton>
                )}
              </div>
            </div>

            {/* E-mail */}
            <div className="rounded-sm border border-slate-200 bg-white p-6 transition-colors duration-300 focus-within:border-brand-navy/40">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    E-mail
                  </p>
                  {campoEditando === "email" ? (
                    <div className="mt-2 flex flex-col gap-1">
                      <input
                        id="email"
                        type="email"
                        autoFocus
                        className={inputClass}
                        {...register("email")}
                      />
                      {errors.email && <p className={errorClass}>{errors.email.message}</p>}
                    </div>
                  ) : (
                    <p className="mt-1 truncate text-base text-brand-navy">{usuario.email}</p>
                  )}
                </div>

                {campoEditando === "email" ? (
                  <div className="flex shrink-0 gap-2">
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
                ) : (
                  <FormButton
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => iniciarEdicao("email")}
                  >
                    Editar
                  </FormButton>
                )}
              </div>
            </div>

            {/* CPF */}
            <div className="rounded-sm border border-slate-200 bg-white p-6 transition-colors duration-300 focus-within:border-brand-navy/40">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    CPF
                  </p>
                  {campoEditando === "cpf" ? (
                    <div className="mt-2 flex flex-col gap-1">
                      <input
                        id="cpf"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="000.000.000-00"
                        autoFocus
                        className={inputClass}
                        {...register("cpf", {
                          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                            event.target.value = formatarCpf(event.target.value);
                          },
                        })}
                      />
                      {errors.cpf && <p className={errorClass}>{errors.cpf.message}</p>}
                    </div>
                  ) : (
                    <p className="mt-1 truncate text-base text-brand-navy">
                      {usuario.cpf ? formatarCpf(usuario.cpf) : "Não informado"}
                    </p>
                  )}
                </div>

                {campoEditando === "cpf" ? (
                  <div className="flex shrink-0 gap-2">
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
                ) : (
                  <FormButton
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => iniciarEdicao("cpf")}
                  >
                    {usuario.cpf ? "Editar" : "Adicionar"}
                  </FormButton>
                )}
              </div>
            </div>

            {/* Telefone */}
            <div className="rounded-sm border border-slate-200 bg-white p-6 transition-colors duration-300 focus-within:border-brand-navy/40">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Telefone
                  </p>
                  {campoEditando === "telefone" ? (
                    <div className="mt-2 flex flex-col gap-1">
                      <input
                        id="telefone"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="(00) 00000-0000"
                        autoFocus
                        className={inputClass}
                        {...register("telefone", {
                          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                            event.target.value = formatarTelefone(event.target.value);
                          },
                        })}
                      />
                      {errors.telefone && <p className={errorClass}>{errors.telefone.message}</p>}
                    </div>
                  ) : (
                    <p className="mt-1 truncate text-base text-brand-navy">
                      {usuario.telefone ? formatarTelefone(usuario.telefone) : "Não informado"}
                    </p>
                  )}
                </div>

                {campoEditando === "telefone" ? (
                  <div className="flex shrink-0 gap-2">
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
                ) : (
                  <FormButton
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => iniciarEdicao("telefone")}
                  >
                    {usuario.telefone ? "Editar" : "Adicionar"}
                  </FormButton>
                )}
              </div>
            </div>
          </form>
        )}
      </RevealOnScroll>
    </div>
  );
}
