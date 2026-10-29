"use client";

import { FormEvent, useEffect, useState } from "react";
import { TicketPercent, X } from "lucide-react";
import FormButton from "@/components/ui/FormButton";
import { getErrorMessage } from "@/lib/errors";
import type {
  Cupom,
  CupomCliente,
  PublicoCupom,
  SalvarCupomPayload,
  TipoDescontoCupom,
} from "@/lib/types/loja";
import { buscarClientesCupom } from "@/services/cupons";

const reais = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const PUBLICOS: { id: PublicoCupom; titulo: string; texto: string }[] = [
  {
    id: "TODOS",
    titulo: "Todo mundo",
    texto: "Qualquer visitante vê a faixa e pode usar o código.",
  },
  {
    id: "NOVOS_CLIENTES",
    titulo: "Novos clientes",
    texto: "Só quem ainda não concluiu uma compra.",
  },
  {
    id: "USUARIOS",
    titulo: "Clientes escolhidos",
    texto: "Só as pessoas que você marcar. A faixa aparece só para elas.",
  },
];

type Rascunho = {
  codigo: string;
  mensagem: string;
  tipoDesconto: TipoDescontoCupom;
  valor: string;
  publico: PublicoCupom;
  ativo: boolean;
  mostrarNoTopo: boolean;
  valorMinimo: string;
  limiteUsos: string;
  inicioEm: string;
  fimEm: string;
  usuarios: CupomCliente[];
};

function dataParaCampo(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

function rascunhoDe(cupom?: Cupom): Rascunho {
  return {
    codigo: cupom?.codigo ?? "",
    mensagem: cupom?.mensagem ?? "",
    tipoDesconto: cupom?.tipoDesconto ?? "PERCENTUAL",
    valor: cupom ? String(cupom.valor) : "",
    publico: cupom?.publico ?? "TODOS",
    ativo: cupom?.ativo ?? true,
    mostrarNoTopo: cupom?.mostrarNoTopo ?? true,
    valorMinimo: cupom?.valorMinimo != null ? String(cupom.valorMinimo) : "",
    limiteUsos: cupom?.limiteUsos != null ? String(cupom.limiteUsos) : "",
    inicioEm: dataParaCampo(cupom?.inicioEm ?? null),
    fimEm: dataParaCampo(cupom?.fimEm ?? null),
    usuarios: cupom?.usuarios ?? [],
  };
}

function numeroOuNulo(valor: string): number | null {
  const limpo = valor.trim().replace(",", ".");
  if (!limpo) return null;
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : null;
}

export function montarPayload(rascunho: Rascunho): SalvarCupomPayload {
  return {
    codigo: rascunho.codigo.trim().toUpperCase(),
    mensagem: rascunho.mensagem.trim(),
    tipoDesconto: rascunho.tipoDesconto,
    valor: numeroOuNulo(rascunho.valor) ?? 0,
    publico: rascunho.publico,
    usuarioIds:
      rascunho.publico === "USUARIOS"
        ? rascunho.usuarios.map((cliente) => cliente.id)
        : [],
    ativo: rascunho.ativo,
    mostrarNoTopo: rascunho.mostrarNoTopo,
    valorMinimo: numeroOuNulo(rascunho.valorMinimo),
    limiteUsos: numeroOuNulo(rascunho.limiteUsos),
    inicioEm: rascunho.inicioEm ? `${rascunho.inicioEm}T00:00:00.000-03:00` : null,
    fimEm: rascunho.fimEm ? `${rascunho.fimEm}T23:59:59.999-03:00` : null,
  };
}

function rotuloDesconto(cupom: Cupom): string {
  return cupom.tipoDesconto === "PERCENTUAL"
    ? `${cupom.valor}%`
    : reais.format(cupom.valor);
}

function rotuloPublico(cupom: Cupom): string {
  if (cupom.publico === "TODOS") return "Todo mundo";
  if (cupom.publico === "NOVOS_CLIENTES") return "Novos clientes";
  const n = cupom.usuarios.length;
  return n === 1 ? "1 cliente" : `${n} clientes`;
}

const campo =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/40";

type FormProps = {
  cupom?: Cupom;
  onSubmit: (payload: SalvarCupomPayload) => Promise<void>;
  onCancel: () => void;
};

export function CupomForm({ cupom, onSubmit, onCancel }: FormProps) {
  const [rascunho, setRascunho] = useState<Rascunho>(() => rascunhoDe(cupom));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [encontrados, setEncontrados] = useState<CupomCliente[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    setRascunho(rascunhoDe(cupom));
  }, [cupom]);

  useEffect(() => {
    if (rascunho.publico !== "USUARIOS") return;
    let vivo = true;
    const espera = window.setTimeout(() => {
      setBuscando(true);
      buscarClientesCupom(busca)
        .then((clientes) => {
          if (vivo) setEncontrados(clientes);
        })
        .catch(() => {
          if (vivo) setEncontrados([]);
        })
        .finally(() => {
          if (vivo) setBuscando(false);
        });
    }, 250);
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, [busca, rascunho.publico]);

  function patch(parcial: Partial<Rascunho>) {
    setRascunho((atual) => ({ ...atual, ...parcial }));
  }

  async function enviar(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    if (!rascunho.codigo.trim()) {
      setErro("Escreva o código do cupom.");
      return;
    }
    if (!rascunho.mensagem.trim()) {
      setErro("Escreva o texto que aparece na faixa.");
      return;
    }
    const valor = numeroOuNulo(rascunho.valor);
    if (valor == null || valor <= 0) {
      setErro("Informe o valor do desconto.");
      return;
    }
    if (rascunho.tipoDesconto === "PERCENTUAL" && valor > 100) {
      setErro("A porcentagem não pode passar de 100.");
      return;
    }
    if (rascunho.publico === "USUARIOS" && rascunho.usuarios.length === 0) {
      setErro("Escolha pelo menos um cliente.");
      return;
    }
    setSalvando(true);
    try {
      await onSubmit(montarPayload(rascunho));
    } catch (err) {
      setErro(getErrorMessage(err, "Não foi possível salvar o cupom."));
      setSalvando(false);
    }
  }

  const previa =
    rascunho.mensagem.trim() || "O texto da faixa aparece aqui";

  return (
    <form onSubmit={enviar} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
          1. O desconto
        </h3>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Código
          <input
            value={rascunho.codigo}
            onChange={(event) =>
              patch({ codigo: event.target.value.toUpperCase() })
            }
            placeholder="BEMVINDO10"
            className={`${campo} uppercase tracking-wide`}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["PERCENTUAL", "Porcentagem", "Ex.: 10% em cima dos produtos"],
              ["FIXO", "Valor em reais", "Ex.: R$ 20 de desconto"],
            ] as const
          ).map(([id, titulo, texto]) => (
            <button
              key={id}
              type="button"
              onClick={() => patch({ tipoDesconto: id })}
              className={`rounded-xl border px-4 py-3 text-left ${
                rascunho.tipoDesconto === id
                  ? "border-brand-navy bg-brand-navy/5"
                  : "border-slate-200 bg-white"
              }`}
            >
              <span className="block text-sm font-semibold text-brand-navy">
                {titulo}
              </span>
              <span className="mt-1 block text-xs text-slate-500">{texto}</span>
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          {rascunho.tipoDesconto === "PERCENTUAL" ? "Porcentagem" : "Valor (R$)"}
          <input
            inputMode="decimal"
            value={rascunho.valor}
            onChange={(event) => patch({ valor: event.target.value })}
            placeholder={rascunho.tipoDesconto === "PERCENTUAL" ? "10" : "20"}
            className={campo}
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
          2. Quem pode usar
        </h3>
        <div className="grid gap-2">
          {PUBLICOS.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              onClick={() => patch({ publico: opcao.id })}
              className={`rounded-xl border px-4 py-3 text-left ${
                rascunho.publico === opcao.id
                  ? "border-brand-navy bg-brand-navy/5"
                  : "border-slate-200 bg-white"
              }`}
            >
              <span className="block text-sm font-semibold text-brand-navy">
                {opcao.titulo}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {opcao.texto}
              </span>
            </button>
          ))}
        </div>
        {rascunho.publico === "USUARIOS" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Buscar cliente
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Nome ou e-mail"
                className={campo}
              />
            </label>
            {rascunho.usuarios.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {rascunho.usuarios.map((cliente) => (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          usuarios: rascunho.usuarios.filter(
                            (item) => item.id !== cliente.id,
                          ),
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-brand-navy px-3 py-1 text-xs text-white"
                    >
                      {cliente.nome}
                      <X className="h-3 w-3" aria-hidden />
                      <span className="sr-only">Remover {cliente.nome}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <ul className="mt-3 flex max-h-40 flex-col gap-1 overflow-y-auto">
              {buscando && (
                <li className="px-2 py-1 text-xs text-slate-500">Buscando…</li>
              )}
              {!buscando &&
                encontrados
                  .filter(
                    (cliente) =>
                      !rascunho.usuarios.some((item) => item.id === cliente.id),
                  )
                  .map((cliente) => (
                    <li key={cliente.id}>
                      <button
                        type="button"
                        onClick={() =>
                          patch({ usuarios: [...rascunho.usuarios, cliente] })
                        }
                        className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-white"
                      >
                        <span className="text-sm text-brand-navy">
                          {cliente.nome}
                        </span>
                        <span className="text-xs text-slate-500">
                          {cliente.email}
                        </span>
                      </button>
                    </li>
                  ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
          3. Quando vale
        </h3>
        <p className="text-xs text-slate-500">
          Deixe em branco o que não quiser limitar. O desconto vale sobre os
          produtos; o frete continua igual.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Compra mínima (R$)
            <input
              inputMode="decimal"
              value={rascunho.valorMinimo}
              onChange={(event) => patch({ valorMinimo: event.target.value })}
              placeholder="Opcional"
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Limite de usos
            <input
              inputMode="numeric"
              value={rascunho.limiteUsos}
              onChange={(event) => patch({ limiteUsos: event.target.value })}
              placeholder="Opcional"
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Começa em
            <input
              type="date"
              value={rascunho.inicioEm}
              onChange={(event) => patch({ inicioEm: event.target.value })}
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Termina em
            <input
              type="date"
              value={rascunho.fimEm}
              onChange={(event) => patch({ fimEm: event.target.value })}
              className={campo}
            />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
          4. Faixa no topo do site
        </h3>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={rascunho.mostrarNoTopo}
            onChange={(event) => patch({ mostrarNoTopo: event.target.checked })}
            className="mt-1 h-4 w-4 accent-brand-navy"
          />
          <span>
            Mostrar acima do menu
            <span className="mt-1 block text-xs text-slate-500">
              Se vários cupons estiverem ligados, cada pessoa vê o mais
              específico para ela.
            </span>
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Texto da faixa
          <input
            value={rascunho.mensagem}
            onChange={(event) => patch({ mensagem: event.target.value })}
            maxLength={140}
            placeholder="Use o cupom BEMVINDO10 e ganhe 10% off"
            className={campo}
          />
        </label>
        <div className="overflow-hidden rounded-lg border border-[#e8d7b8]">
          <div className="bg-[#e8d7b8] px-4 py-2 text-center">
            <p className="truncate text-[11px] font-medium tracking-[0.14em] text-brand-navy uppercase">
              {previa}
            </p>
          </div>
          <p className="bg-white px-3 py-2 text-center text-[11px] text-slate-400">
            Prévia — assim aparece acima do menu
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={rascunho.ativo}
            onChange={(event) => patch({ ativo: event.target.checked })}
            className="h-4 w-4 accent-brand-navy"
          />
          Cupom ativo
        </label>
      </section>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <FormButton type="submit" variant="primary" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar cupom"}
        </FormButton>
        <FormButton type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </FormButton>
      </div>
    </form>
  );
}

type ListaProps = {
  cupons: Cupom[];
  onEdit: (cupom: Cupom) => void;
  onToggle: (cupom: Cupom) => void;
  onRemove: (cupom: Cupom) => void;
};

export function ListaCupons({ cupons, onEdit, onToggle, onRemove }: ListaProps) {
  if (cupons.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <TicketPercent className="h-6 w-6 text-brand-orange" aria-hidden />
        <p className="font-medium text-brand-navy">Nenhum cupom ainda</p>
        <p className="max-w-sm text-sm text-slate-500">
          Crie o primeiro código. Ele pode valer para todo mundo, só para novos
          clientes ou para pessoas específicas.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-3">
      {cupons.map((cupom) => (
        <li
          key={cupom.id}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-lg font-semibold tracking-wide text-brand-navy">
                {cupom.codigo}
              </p>
              <p className="mt-1 text-sm text-slate-600">{cupom.mensagem}</p>
            </div>
            <p className="text-lg font-semibold text-brand-navy">
              {rotuloDesconto(cupom)}
            </p>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {cupom.valorMinimo != null
              ? `Produtos a partir de ${reais.format(cupom.valorMinimo)}`
              : "Sem valor mínimo"}
            {" · "}
            {cupom.inicioEm || cupom.fimEm
              ? `${cupom.inicioEm ? new Date(cupom.inicioEm).toLocaleDateString("pt-BR") : "agora"} até ${cupom.fimEm ? new Date(cupom.fimEm).toLocaleDateString("pt-BR") : "sem fim"}`
              : "Sem prazo"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
              {rotuloPublico(cupom)}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 ${
                cupom.ativo
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {cupom.ativo ? "Ativo" : "Pausado"}
            </span>
            <span className="rounded-full bg-[#e8d7b8]/60 px-2.5 py-1 text-brand-navy">
              {cupom.mostrarNoTopo ? "Faixa no topo" : "Sem faixa"}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
              {cupom.limiteUsos != null
                ? `${cupom.usos} de ${cupom.limiteUsos} usos`
                : `${cupom.usos} ${cupom.usos === 1 ? "uso" : "usos"}`}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <FormButton variant="secondary" onClick={() => onEdit(cupom)}>
              Editar
            </FormButton>
            <FormButton variant="ghost" onClick={() => onToggle(cupom)}>
              {cupom.ativo ? "Pausar" : "Ativar"}
            </FormButton>
            {cupom.usos === 0 && (
              <FormButton variant="danger" onClick={() => onRemove(cupom)}>
                Excluir
              </FormButton>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
