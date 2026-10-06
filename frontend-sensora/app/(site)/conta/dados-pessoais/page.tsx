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
import { isAxiosError } from "axios";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import Skeleton from "@/components/ui/Skeleton";
import AccountPageHeader from "@/components/conta/AccountPageHeader";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { atualizarMeuPerfil, buscarMeuPerfil } from "@/services/conta";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { EMPRESA, ROTAS_LEGAIS, mailtoAssunto } from "@/lib/empresa";
import { cpfValido } from "@/lib/cpf";
import { telefoneValido } from "@/lib/telefone";
import type { Usuario } from "@/lib/types/loja";
import CartaoPerfilDados from "@/components/conta/CartaoPerfilDados";

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
  // Só é enviada quando o e-mail muda de verdade (ver onSubmit).
  senhaAtual: z.string(),
});

type DadosFormValues = z.infer<typeof dadosSchema>;
type Campo = "nome" | "email" | "cpf" | "telefone";

// Mesma normalização do backend (normalizarEmail): só caixa/espaços
// diferentes não contam como troca de e-mail.
function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function valoresIniciais(usuario: Usuario): DadosFormValues {
  return {
    nome: usuario.nome,
    email: usuario.email,
    cpf: usuario.cpf ?? "",
    telefone: usuario.telefone ?? "",
    senhaAtual: "",
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
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosFormValues>({
    resolver: zodResolver(dadosSchema),
    defaultValues: { nome: "", email: "", cpf: "", telefone: "", senhaAtual: "" },
  });

  // Troca de e-mail exige a senha atual; o campo só aparece nesse caso.
  const emailDigitado = useWatch({ control, name: "email" });
  const trocandoEmail =
    campoEditando === "email" &&
    usuario !== null &&
    normalizarEmail(emailDigitado) !== normalizarEmail(usuario.email);

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

  async function onSubmit({ senhaAtual, ...dados }: DadosFormValues) {
    if (trocandoEmail && !senhaAtual) {
      setError("senhaAtual", { message: "Informe sua senha atual para alterar o e-mail." });
      return;
    }
    try {
      const atualizado = await atualizarMeuPerfil(
        trocandoEmail ? { ...dados, senhaAtual } : dados,
      );
      // Troca de e-mail: o backend mantém o e-mail atual como oficial e
      // devolve o novo em `emailPendente` até ele ser confirmado pelo link.
      setUsuario(atualizado);
      reset(valoresIniciais(atualizado));
      setCampoEditando(null);
      toast.success(
        trocandoEmail && atualizado.emailPendente
          ? `Dados atualizados com sucesso. Seu e-mail atual continua sendo o oficial até você confirmar o novo endereço. Enviamos um link de confirmação para ${atualizado.emailPendente}.`
          : "Dados atualizados com sucesso.",
      );
    } catch (err) {
      const mensagem = getErrorMessage(err, "Não foi possível atualizar seus dados.");
      // 400 na troca de e-mail = senha atual incorreta: mostra no próprio campo.
      if (trocandoEmail && isAxiosError(err) && err.response?.status === 400) {
        setError("senhaAtual", { message: mensagem });
        return;
      }
      toast.error(mensagem);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pt-8 pb-24 sm:pb-32 lg:px-10">
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
            <CartaoPerfilDados
              usuario={usuario}
              campoEditando={campoEditando}
              register={register}
              errors={errors}
              isSubmitting={isSubmitting}
              trocandoEmail={trocandoEmail}
              onEditar={iniciarEdicao}
              onCancelar={cancelarEdicao}
            />
          </form>
        )}

        <div className="mt-8 space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            O CPF desta página é o usado na nota fiscal. Se ficar em branco,
            pedimos por e-mail antes de emitir.
          </p>
          <p>
            Para pedir exclusão da conta ou outra solicitação da LGPD, escreva
            para{" "}
            <a
              href={mailtoAssunto(
                "Privacidade — pedido de titular (LGPD)",
                "Olá,\n\nQuero exercer um direito sobre os meus dados.\n\nNome:\nE-mail da conta:\n",
              )}
              className="text-brand-navy underline underline-offset-4"
            >
              {EMPRESA.emailSuporte}
            </a>
            . Os detalhes estão na{" "}
            <Link
              href={ROTAS_LEGAIS.privacidade}
              className="text-brand-navy underline underline-offset-4"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </RevealOnScroll>
    </div>
  );
}
