"use client";

// Apresentação do formulário de endereço em Minha Conta > Endereços: campos
// com ícone e, ao lado, um cartão com o progresso do preenchimento e a
// prévia de como o endereço vai para a entrega (escolhido na comparação de
// designs, "Prévia + progresso"). Validação, busca do CEP e envio continuam
// no EnderecoForm; o checkout segue com a apresentação simples.
import type { ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Building2, Check, Hash, Home, Map, MapPin, Navigation } from "lucide-react";
import { cepCompleto } from "@/lib/cep";

export type NomeCampoEndereco =
  | "cep"
  | "rua"
  | "numero"
  | "complemento"
  | "bairro"
  | "cidade"
  | "estado";

type Valores = Partial<Record<NomeCampoEndereco, string>>;

const ICONES: Record<NomeCampoEndereco, ReactNode> = {
  cep: <Navigation className="h-4 w-4" aria-hidden />,
  rua: <Home className="h-4 w-4" aria-hidden />,
  numero: <Hash className="h-4 w-4" aria-hidden />,
  complemento: <Building2 className="h-4 w-4" aria-hidden />,
  bairro: <Map className="h-4 w-4" aria-hidden />,
  cidade: <MapPin className="h-4 w-4" aria-hidden />,
  estado: <MapPin className="h-4 w-4" aria-hidden />,
};

const OBRIGATORIOS: { nome: NomeCampoEndereco; rotulo: string }[] = [
  { nome: "cep", rotulo: "CEP" },
  { nome: "rua", rotulo: "Rua" },
  { nome: "numero", rotulo: "Número" },
  { nome: "bairro", rotulo: "Bairro" },
  { nome: "cidade", rotulo: "Cidade" },
  { nome: "estado", rotulo: "UF" },
];

export function CampoComIcone({
  nome,
  rotulo,
  registro,
  erro,
  opcional = false,
  placeholder,
  maxLength,
  maiusculas = false,
  abaixo,
}: {
  nome: NomeCampoEndereco;
  rotulo: string;
  registro: UseFormRegisterReturn;
  erro?: string;
  opcional?: boolean;
  placeholder?: string;
  maxLength?: number;
  maiusculas?: boolean;
  abaixo?: ReactNode;
}) {
  const ehCep = nome === "cep";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={nome} className="text-[13px] font-medium text-brand-navy">
        {rotulo}
        {opcional && <span className="font-normal text-slate-400"> (opcional)</span>}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {ICONES[nome]}
        </span>
        <input
          id={nome}
          type="text"
          placeholder={placeholder}
          maxLength={ehCep ? 9 : maxLength}
          inputMode={ehCep ? "numeric" : undefined}
          className={`h-11 w-full rounded-lg border bg-white pl-10 pr-3 text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
            erro
              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
              : "border-slate-200 focus:border-brand-navy focus:ring-brand-navy/10"
          } ${maiusculas ? "uppercase" : ""}`}
          {...registro}
        />
      </div>
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      {abaixo}
    </div>
  );
}

// Progresso dos campos obrigatórios + prévia da entrega, montada enquanto a
// pessoa digita. Com tudo preenchido, pede para conferir antes de salvar.
function PainelPreviaProgresso({ previa, erros }: { previa: Valores; erros: Valores }) {
  const pronto = (nome: NomeCampoEndereco) =>
    !erros[nome] &&
    (nome === "cep" ? cepCompleto(previa.cep ?? "") : Boolean(previa[nome]?.trim()));
  const feitos = OBRIGATORIOS.filter((c) => pronto(c.nome)).length;
  const completo = feitos === OBRIGATORIOS.length;
  const vazio = <span className="text-white/30">—</span>;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-brand-navy p-6 text-white">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-2xl transition-colors duration-500 ${
          completo ? "bg-emerald-400/25" : "bg-brand-orange/25"
        }`}
      />

      <div className="relative">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">{completo ? "Tudo pronto" : "Falta pouco"}</p>
          <p className="text-xs tabular-nums text-white/60">
            {feitos} de {OBRIGATORIOS.length}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-[width,background-color] duration-500 ${
              completo
                ? "bg-emerald-400"
                : "bg-gradient-to-r from-brand-orange to-brand-orange-light"
            }`}
            style={{ width: `${(feitos / OBRIGATORIOS.length) * 100}%` }}
          />
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {OBRIGATORIOS.map((c) => {
            const ok = pronto(c.nome);
            const comErro = Boolean(erros[c.nome]);
            return (
              <li
                key={c.nome}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  ok
                    ? "bg-emerald-400/15 text-emerald-200"
                    : comErro
                      ? "bg-red-400/20 text-red-200"
                      : "bg-white/5 text-white/50"
                }`}
              >
                {ok ? <Check className="h-3 w-3" aria-hidden /> : comErro ? "!" : null}
                {c.rotulo}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative mt-6 border-t border-white/10 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
          Prévia da entrega
        </p>
        <p className="mt-3 text-lg font-semibold leading-snug">
          {previa.rua || previa.numero ? (
            <>
              {previa.rua || vazio}
              {previa.numero ? `, ${previa.numero}` : ""}
            </>
          ) : (
            vazio
          )}
        </p>
        {previa.complemento && <p className="text-sm text-white/70">{previa.complemento}</p>}
        <p className="mt-1 text-sm text-white/70">
          {previa.bairro || previa.cidade || previa.estado ? (
            <>
              {previa.bairro || "—"} · {previa.cidade || "—"}/{(previa.estado || "—").toUpperCase()}
            </>
          ) : (
            vazio
          )}
        </p>
        <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/40">CEP</p>
        <p className="font-mono text-xl tracking-wider">{previa.cep || vazio}</p>
      </div>

      <p
        className={`relative mt-5 rounded-xl px-3 py-2 text-xs transition-colors ${
          completo ? "bg-emerald-400/15 text-emerald-100" : "text-white/50"
        }`}
      >
        {completo
          ? "Confira a prévia: é assim que o endereço vai para a entrega. Se estiver certo, é só salvar."
          : "A prévia se completa enquanto você preenche."}
      </p>
    </div>
  );
}

// Campos à esquerda e o cartão à direita (fixo ao rolar); no celular, o
// cartão vem depois dos campos.
export function LayoutComPrevia({
  campos,
  previa,
  erros,
  editando,
  enviando,
  onCancel,
}: {
  campos: Record<NomeCampoEndereco, ReactNode>;
  previa: Valores;
  erros: Valores;
  editando: boolean;
  enviando: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 rounded-3xl border border-slate-200 bg-slate-50/60 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6">
        <div className="max-w-xs">{campos.cep}</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
          {campos.rua}
          {campos.numero}
        </div>
        {campos.complemento}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_2fr_1fr]">
          {campos.bairro}
          {campos.cidade}
          {campos.estado}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="rounded-xl bg-brand-navy px-6 py-2.5 text-sm font-semibold text-white transition-[transform,background-color] hover:-translate-y-px hover:bg-brand-navy-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Salvando..." : editando ? "Salvar edição" : "Salvar endereço"}
          </button>
        </div>
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <PainelPreviaProgresso previa={previa} erros={erros} />
      </div>
    </div>
  );
}
