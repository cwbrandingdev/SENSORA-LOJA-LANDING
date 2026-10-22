"use client";

// Formulário de proposta da página "Para empresas". Envia para
// POST /public/propostas-empresas (sem login); a equipe recebe e-mail e o
// pedido aparece no Admin (Empresas). O campo "site" fica escondido: só
// robôs o preenchem, e o backend descarta esses envios em silêncio.
//
// No topo, um "ingresso" azul-marinho resume o pedido e se preenche enquanto
// a pessoa digita; os campos ficam embaixo.
import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import {
  CARGOS_PROPOSTA,
  OBJETIVOS_PROPOSTA,
  QUANTIDADES_PROPOSTA,
  type NovaPropostaEmpresa,
} from "@/lib/propostas-empresas";
import { formatarTelefone, telefoneValido } from "@/lib/telefone";
import { enviarPropostaEmpresa } from "@/services/propostas-empresas";

const VAZIO: NovaPropostaEmpresa = {
  nome: "",
  email: "",
  telefone: "",
  empresa: "",
  cargo: "",
  objetivo: "",
  quantidade: "",
  mensagem: "",
  site: "",
};

const campo =
  "w-full rounded-sm border border-slate-300 bg-white px-4 py-3 text-sm text-brand-navy placeholder:text-slate-400 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const rotulo = "mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-navy/80";

function Campo({ id, texto, largo = false, children }: { id: string; texto: string; largo?: boolean; children: ReactNode }) {
  return (
    <div className={largo ? "sm:col-span-2" : ""}>
      <label htmlFor={id} className={rotulo}>
        {texto}
      </label>
      {children}
    </div>
  );
}

export default function FormularioProposta() {
  const [dados, setDados] = useState<NovaPropostaEmpresa>(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  function alterar<K extends keyof NovaPropostaEmpresa>(chave: K, valor: NovaPropostaEmpresa[K]) {
    setDados((atual) => ({ ...atual, [chave]: valor }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!telefoneValido(dados.telefone)) {
      setErro("Informe um telefone com DDD.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      await enviarPropostaEmpresa(dados);
      setEnviado(true);
    } catch (err) {
      setErro(getErrorMessage(err, "Não foi possível enviar agora. Tente novamente em instantes."));
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 bg-white p-10 text-center shadow-sm">
        <CheckCircle2 aria-hidden className="h-10 w-10 text-brand-orange" strokeWidth={1.5} />
        <p className="font-serif text-2xl text-brand-navy">Recebemos seu pedido de proposta</p>
        <p className="max-w-sm text-sm leading-relaxed text-slate-600">
          Nossa equipe vai entrar em contato pelo e-mail ou telefone informado para entender o seu projeto.
        </p>
      </div>
    );
  }

  function selecao(chave: "cargo" | "quantidade" | "objetivo", opcoes: readonly string[]) {
    return (
      <select
        id={`proposta-${chave}`}
        required
        value={dados[chave]}
        onChange={(e) => alterar(chave, e.target.value)}
        className={campo}
      >
        <option value="" disabled>
          Selecione
        </option>
        {opcoes.map((opcao) => (
          <option key={opcao}>{opcao}</option>
        ))}
      </select>
    );
  }

  const resumo: [string, string][] = [
    ["Empresa", dados.empresa],
    ["Objetivo", dados.objetivo],
    ["Quantidade", dados.quantidade],
    ["Contato", [dados.nome, dados.email].filter(Boolean).join(" · ")],
  ];

  return (
    <form onSubmit={enviar} className="relative">
      {/* Ingresso que se preenche enquanto a pessoa digita. */}
      <div className="relative rounded-2xl bg-brand-navy p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-orange-light">Seu pedido de proposta</p>
          <p className="font-serif text-sm italic text-white/60">Sensora para empresas</p>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
          {resumo.map(([titulo, valor]) => (
            <div key={titulo} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-[0.18em] text-white/50">{titulo}</dt>
              <dd className={`mt-0.5 truncate font-serif text-lg ${valor ? "text-white" : "text-white/25"}`}>{valor || "—"}</dd>
            </div>
          ))}
        </dl>
        {/* Recortes laterais do ingresso (mesma cor do fundo da seção). */}
        <span aria-hidden className="absolute -bottom-3 left-8 h-6 w-6 rounded-full bg-stone-100" />
        <span aria-hidden className="absolute -bottom-3 right-8 h-6 w-6 rounded-full bg-stone-100" />
      </div>

      <div className="rounded-b-2xl border-t-2 border-dashed border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo id="proposta-empresa" texto="Empresa">
            <input
              id="proposta-empresa"
              required
              maxLength={150}
              autoComplete="organization"
              value={dados.empresa}
              onChange={(e) => alterar("empresa", e.target.value)}
              className={campo}
            />
          </Campo>
          <Campo id="proposta-nome" texto="Nome">
            <input
              id="proposta-nome"
              required
              maxLength={120}
              autoComplete="name"
              value={dados.nome}
              onChange={(e) => alterar("nome", e.target.value)}
              className={campo}
            />
          </Campo>
          <Campo id="proposta-objetivo" texto="Objetivo">
            {selecao("objetivo", OBJETIVOS_PROPOSTA)}
          </Campo>
          <Campo id="proposta-quantidade" texto="Quantidade">
            {selecao("quantidade", QUANTIDADES_PROPOSTA)}
          </Campo>
          <Campo id="proposta-email" texto="E-mail corporativo">
            <input
              id="proposta-email"
              type="email"
              required
              maxLength={200}
              autoComplete="email"
              value={dados.email}
              onChange={(e) => alterar("email", e.target.value)}
              className={campo}
            />
          </Campo>
          <Campo id="proposta-telefone" texto="Telefone / WhatsApp">
            <input
              id="proposta-telefone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="(41) 99999-9999"
              value={dados.telefone}
              onChange={(e) => alterar("telefone", formatarTelefone(e.target.value))}
              className={campo}
            />
          </Campo>
          <Campo id="proposta-cargo" texto="Cargo" largo>
            {selecao("cargo", CARGOS_PROPOSTA)}
          </Campo>
          <Campo id="proposta-mensagem" texto="Conte sobre o projeto (opcional)" largo>
            <textarea
              id="proposta-mensagem"
              rows={4}
              maxLength={2000}
              placeholder="Data, ocasião, ideias de personalização…"
              value={dados.mensagem}
              onChange={(e) => alterar("mensagem", e.target.value)}
              className={`${campo} resize-y`}
            />
          </Campo>
        </div>

        {/* Armadilha para robôs: fora da tela e fora da navegação por teclado. */}
        <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
          <label htmlFor="proposta-site">Site</label>
          <input
            id="proposta-site"
            tabIndex={-1}
            autoComplete="off"
            value={dados.site}
            onChange={(e) => alterar("site", e.target.value)}
          />
        </div>

        {erro && (
          <p role="alert" className="mt-5 text-sm text-red-600">
            {erro}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={enviando}
            className="rounded-full bg-brand-orange px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-navy disabled:cursor-wait disabled:opacity-60"
          >
            {enviando ? "Enviando…" : "Solicitar proposta"}
          </button>
        </div>
      </div>
    </form>
  );
}
