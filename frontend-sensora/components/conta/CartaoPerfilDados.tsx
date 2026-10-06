"use client";

// Apresentação de Minha Conta > Dados pessoais (escolhida na comparação de
// designs, "Cartão de perfil"): cartão azul-marinho com iniciais, nome e
// situação do e-mail no topo e os campos em blocos com um lápis para editar.
// A lógica (carregar, editar um campo por vez, salvar) continua na página.
import type { ChangeEvent } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { CreditCard, Mail, Pencil, Phone, User, type LucideIcon } from "lucide-react";
import FormButton from "@/components/ui/FormButton";
import { formatarCpf } from "@/lib/cpf";
import { formatarTelefone } from "@/lib/telefone";
import type { Usuario } from "@/lib/types/loja";

type Campo = "nome" | "email" | "cpf" | "telefone";
type Valores = { nome: string; email: string; cpf: string; telefone: string; senhaAtual: string };

export type PropsDados = {
  usuario: Usuario;
  campoEditando: Campo | null;
  register: UseFormRegister<Valores>;
  errors: FieldErrors<Valores>;
  isSubmitting: boolean;
  trocandoEmail: boolean;
  onEditar: (campo: Campo) => void;
  onCancelar: () => void;
};

const CAMPOS: { id: Campo; rotulo: string; icone: LucideIcon }[] = [
  { id: "nome", rotulo: "Nome", icone: User },
  { id: "email", rotulo: "E-mail", icone: Mail },
  { id: "cpf", rotulo: "CPF", icone: CreditCard },
  { id: "telefone", rotulo: "Telefone", icone: Phone },
];

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-colors duration-200 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";

function valorDe(campo: Campo, usuario: Usuario) {
  if (campo === "cpf") return usuario.cpf ? formatarCpf(usuario.cpf) : null;
  if (campo === "telefone") return usuario.telefone ? formatarTelefone(usuario.telefone) : null;
  return usuario[campo];
}

function CampoInput({ campo, register, errors }: { campo: Campo } & Pick<PropsDados, "register" | "errors">) {
  const formatar = campo === "cpf" ? formatarCpf : campo === "telefone" ? formatarTelefone : null;
  return (
    <div className="flex flex-col gap-1">
      <input
        id={campo}
        type={campo === "email" ? "email" : "text"}
        inputMode={formatar ? "numeric" : undefined}
        autoComplete={formatar ? "off" : undefined}
        placeholder={campo === "cpf" ? "000.000.000-00" : campo === "telefone" ? "(00) 00000-0000" : undefined}
        autoFocus
        className={inputClass}
        {...register(campo, {
          onChange: formatar
            ? (event: ChangeEvent<HTMLInputElement>) => {
                event.target.value = formatar(event.target.value);
              }
            : undefined,
        })}
      />
      {errors[campo] && <p className="text-sm text-red-600">{errors[campo]?.message}</p>}
    </div>
  );
}

// Pedida só quando o e-mail está sendo trocado (ver página).
function CampoSenhaAtual({ register, errors }: Pick<PropsDados, "register" | "errors">) {
  return (
    <div className="mt-3 flex flex-col gap-1">
      <label htmlFor="senhaAtual" className="text-[13px] font-medium text-brand-navy">
        Senha atual
      </label>
      <input
        id="senhaAtual"
        type="password"
        autoComplete="current-password"
        className={inputClass}
        {...register("senhaAtual")}
      />
      {errors.senhaAtual && <p className="text-sm text-red-600">{errors.senhaAtual.message}</p>}
    </div>
  );
}

function BotoesSalvar({ isSubmitting, onCancelar }: Pick<PropsDados, "isSubmitting" | "onCancelar">) {
  return (
    <div className="flex shrink-0 gap-2">
      <FormButton type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </FormButton>
      <FormButton type="button" variant="ghost" onClick={onCancelar} disabled={isSubmitting}>
        Cancelar
      </FormButton>
    </div>
  );
}

// Troca de e-mail aguardando confirmação: o endereço atual continua sendo o
// oficial; o novo só aparece aqui, abaixo dele.
function AvisoTrocaPendente({ usuario }: { usuario: Usuario }) {
  if (!usuario.emailPendente) return null;
  return (
    <div className="mt-2 text-sm text-amber-700">
      <p className="font-medium">Troca de e-mail pendente</p>
      <p className="truncate">{usuario.emailPendente}</p>
      <p>Confirme o link enviado para concluir a alteração.</p>
    </div>
  );
}

function AvisoEmail({ usuario }: { usuario: Usuario }) {
  if (usuario.emailVerificado) return null;
  return (
    <p className="mt-2 text-sm text-amber-700">
      E-mail ainda não confirmado. Enviamos um link de confirmação para este
      endereço — confirme para continuar entrando com ele.
    </p>
  );
}

export default function CartaoPerfilDados(props: PropsDados) {
  const { usuario, campoEditando, onEditar } = props;
  const iniciais = usuario.nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-5 rounded-sm bg-brand-navy p-6 text-white">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-orange text-xl font-semibold">
          {iniciais}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{usuario.nome}</p>
          <p className="truncate text-sm text-white/70">{usuario.email}</p>
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              usuario.emailVerificado ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"
            }`}
          >
            {usuario.emailVerificado ? "E-mail confirmado" : "Aguardando confirmação do e-mail"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS.map(({ id, rotulo, icone: Icone }) => {
          const valor = valorDe(id, usuario);
          const editando = campoEditando === id;
          return (
            <div
              key={id}
              className={`rounded-sm border bg-white p-5 transition-colors ${
                editando ? "border-brand-navy/40 sm:col-span-2" : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <Icone className="h-3.5 w-3.5" aria-hidden />
                  {rotulo}
                </p>
                {!editando && (
                  <button
                    type="button"
                    onClick={() => onEditar(id)}
                    aria-label={`${valor ? "Editar" : "Adicionar"} ${rotulo}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-navy"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
              {editando ? (
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <CampoInput campo={id} {...props} />
                    {id === "email" && props.trocandoEmail && <CampoSenhaAtual {...props} />}
                  </div>
                  <BotoesSalvar {...props} />
                </div>
              ) : (
                <>
                  <p className={`mt-2 truncate text-base ${valor ? "text-brand-navy" : "text-slate-400"}`}>
                    {valor ?? "Não informado"}
                  </p>
                  {id === "email" && (
                    <>
                      <AvisoEmail usuario={usuario} />
                      <AvisoTrocaPendente usuario={usuario} />
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
