"use client";

// Barra da edição em lote do painel de produtos. Fechada, é um convite para
// começar; aberta, um cartão com o resumo (marcados e alterações pendentes),
// Cancelar/Salvar e abas Preço, Estoque e Status. As ações não salvam nada:
// só preenchem o rascunho, que passa pela confirmação antes de salvar.
import { useState } from "react";
import { Package, Tag, ToggleRight } from "lucide-react";
import type { AlteracaoProduto, Produto } from "@/lib/types/loja";

// Recebe um produto e diz o que muda nele (ex.: preço atual + 10%).
export type AcaoEmLote = (produto: Produto) => Omit<AlteracaoProduto, "id">;

type Props = {
  emEdicao: boolean;
  totalMudancas: number;
  totalSelecionados: number;
  invalido: boolean;
  onIniciar: () => void;
  onCancelar: () => void;
  onSalvar: () => void;
  onAplicar: (acao: AcaoEmLote) => void;
};

const acoes = {
  definirPreco: (n: number): AcaoEmLote => () => ({ preco: n }),
  // Calcula sobre o preço atual de cada produto, arredondando para centavos.
  reajustarPreco: (n: number): AcaoEmLote => (p) => ({ preco: Math.round(p.preco * (1 + n / 100) * 100) / 100 }),
  definirEstoque: (n: number): AcaoEmLote => () => ({ quantidade: n, somarEstoque: undefined }),
  somarEstoque: (n: number): AcaoEmLote => () => ({ somarEstoque: n, quantidade: undefined }),
  status: (ativo: boolean): AcaoEmLote => () => ({ ativo }),
};

// Campo de valor: aceita vírgula ou ponto ("159,90" ou "159.90").
function useValor() {
  const [valor, setValor] = useState("");
  const numero = Number(valor.replace(",", "."));
  const valido = valor.trim() !== "" && Number.isFinite(numero);
  return { valor, setValor, numero, valido, inteiro: valido && Number.isInteger(numero) };
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

type Aba = "preco" | "estoque" | "status";

const ABAS: { id: Aba; label: string; icone: typeof Tag }[] = [
  { id: "preco", label: "Preço", icone: Tag },
  { id: "estoque", label: "Estoque", icone: Package },
  { id: "status", label: "Status", icone: ToggleRight },
];

const botaoPrimario =
  "rounded-lg bg-brand-navy px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-orange disabled:pointer-events-none disabled:opacity-30";
const botaoSecundario =
  "rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50";
const campo =
  "w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";

export default function BarraEdicaoLote(props: Props) {
  const [aba, setAba] = useState<Aba>("preco");
  const preco = useValor();
  const percentual = useValor();
  const estoque = useValor();
  // Estoque: "somar" (reposição) é o padrão por ser o caso mais comum.
  const [somar, setSomar] = useState(true);
  const semMarcados = props.totalSelecionados === 0;

  if (!props.emEdicao) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-brand-navy">Edição em lote</p>
          <p className="text-xs text-slate-500">Mude preço, estoque e status de vários produtos de uma vez.</p>
        </div>
        <button type="button" onClick={props.onIniciar} className={botaoPrimario}>
          Começar
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-brand-navy">Edição em lote</p>
          <p className="text-xs text-slate-500">
            {plural(props.totalSelecionados, "produto marcado", "produtos marcados")} ·{" "}
            <span className={props.totalMudancas > 0 ? "font-semibold text-brand-orange" : ""}>
              {plural(props.totalMudancas, "alteração pendente", "alterações pendentes")}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={props.onCancelar} className={botaoSecundario}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={props.onSalvar}
            disabled={props.totalMudancas === 0 || props.invalido}
            className={botaoPrimario}
          >
            Salvar alterações
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-100 px-3">
        {ABAS.map(({ id, label, icone: Icone }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
              aba === id ? "border-brand-orange text-brand-navy" : "border-transparent text-slate-500 hover:text-brand-navy"
            }`}
          >
            <Icone className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="px-5 py-4">
        {semMarcados ? (
          <p className="text-sm text-slate-500">Marque os produtos na tabela abaixo para aplicar uma ação.</p>
        ) : aba === "preco" ? (
          <div className="flex flex-wrap gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-500">Mesmo preço para todos os marcados</span>
              <div className="flex gap-2">
                <input
                  aria-label="Novo preço"
                  placeholder="R$ 0,00"
                  inputMode="decimal"
                  value={preco.valor}
                  onChange={(e) => preco.setValor(e.target.value)}
                  className={campo}
                />
                <button
                  type="button"
                  className={botaoPrimario}
                  disabled={!preco.valido || preco.numero <= 0}
                  onClick={() => props.onAplicar(acoes.definirPreco(preco.numero))}
                >
                  Definir preço
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-500">Reajustar em % (use negativo para desconto)</span>
              <div className="flex gap-2">
                <input
                  aria-label="Percentual"
                  placeholder="Ex.: 10"
                  inputMode="decimal"
                  value={percentual.valor}
                  onChange={(e) => percentual.setValor(e.target.value)}
                  className={campo}
                />
                <button
                  type="button"
                  className={botaoPrimario}
                  disabled={!percentual.valido || percentual.numero === 0 || percentual.numero <= -100}
                  onClick={() => props.onAplicar(acoes.reajustarPreco(percentual.numero))}
                >
                  Reajustar
                </button>
              </div>
            </div>
          </div>
        ) : aba === "estoque" ? (
          <div className="flex flex-col gap-3">
            <div className="inline-flex w-fit rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSomar(true)}
                className={`rounded-md px-3 py-1.5 ${somar ? "bg-white text-brand-navy shadow-sm" : "text-slate-500"}`}
              >
                Somar (reposição)
              </button>
              <button
                type="button"
                onClick={() => setSomar(false)}
                className={`rounded-md px-3 py-1.5 ${!somar ? "bg-white text-brand-navy shadow-sm" : "text-slate-500"}`}
              >
                Definir valor exato
              </button>
            </div>
            <div className="flex gap-2">
              <input
                aria-label="Quantidade"
                placeholder="Quantidade"
                inputMode="numeric"
                value={estoque.valor}
                onChange={(e) => estoque.setValor(e.target.value)}
                className={campo}
              />
              <button
                type="button"
                className={botaoPrimario}
                disabled={!estoque.inteiro || estoque.numero < (somar ? 1 : 0)}
                onClick={() =>
                  props.onAplicar(somar ? acoes.somarEstoque(estoque.numero) : acoes.definirEstoque(estoque.numero))
                }
              >
                Aplicar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" className={botaoPrimario} onClick={() => props.onAplicar(acoes.status(true))}>
              Ativar marcados
            </button>
            <button
              type="button"
              onClick={() => props.onAplicar(acoes.status(false))}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
            >
              Desativar marcados
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
