"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, CreditCard, Image as ImageIcon, Mail, RefreshCw, Truck, X } from "lucide-react";
import IntegracaoStatusCard from "@/components/admin/IntegracaoStatusCard";
import MelhorEnvioIntegracaoCard from "@/components/admin/MelhorEnvioIntegracaoCard";
import type { VerificacaoOperacionalResponse } from "@/lib/types/loja";
import {
  buscarStatusAsaas,
  buscarStatusImagekit,
  buscarStatusResend,
  verificarAsaas,
  verificarImagekit,
} from "@/services/integracoes";
import { buscarStatusMelhorEnvio, verificarMelhorEnvio } from "@/services/melhor-envio";

// Central de Integrações — quadro de status: um bloco por serviço, com a
// situação (pronto/pendente), o motivo quando pendente, o ambiente, um
// "Testar conexão" direto no bloco e "Detalhes", que abre o cartão
// completo de sempre (com "Verificar agora"/"Conectar") num painel à
// direita. Só usa as rotas de STATUS e de VERIFICAÇÃO — todas só leitura.

type IdIntegracao = "asaas" | "melhor-envio" | "resend" | "imagekit";

type Integracao = {
  id: IdIntegracao;
  nome: string;
  funcao: string;
  /** Para que serve, em uma frase. */
  papel: string;
  icone: typeof Truck;
  cartao: ReactNode;
};

// Os mesmos cartões que a página já usava — nenhuma prop alterada.
const INTEGRACOES: Integracao[] = [
  {
    id: "asaas",
    nome: "Asaas",
    funcao: "Pagamentos",
    papel: "Recebe os pagamentos (Pix e cartão) e processa reembolsos.",
    icone: CreditCard,
    cartao: (
      <IntegracaoStatusCard
        titulo="Asaas"
        descricaoConfigurado="Gateway de pagamento ativo — Checkout, cobrança e reembolsos passam por aqui."
        descricaoNaoConfigurado="Gateway de pagamento não configurado neste ambiente."
        buscarStatus={buscarStatusAsaas}
        verificarOperacional={verificarAsaas}
        detalhes={(status) => {
          const linhas: Array<{ label: string; valor: string }> = [];
          if (status.baseUrl) linhas.push({ label: "Base URL", valor: status.baseUrl });
          if (status.gatewayAtivo) linhas.push({ label: "Gateway ativo", valor: status.gatewayAtivo });
          return linhas;
        }}
      />
    ),
  },
  {
    id: "melhor-envio",
    nome: "Melhor Envio",
    funcao: "Frete",
    papel: "Calcula as opções e o preço do frete no checkout.",
    icone: Truck,
    cartao: <MelhorEnvioIntegracaoCard />,
  },
  {
    id: "resend",
    nome: "Resend",
    funcao: "E-mail",
    papel: "Envia os e-mails de confirmação de cadastro e de recuperação de senha.",
    icone: Mail,
    cartao: (
      // Resend já foi validado em produção com envio real — sem botão
      // "Verificar agora", só o card de configuração de sempre.
      <IntegracaoStatusCard
        titulo="Resend"
        descricaoConfigurado="Envio de e-mail ativo — confirmação de cadastro e recuperação de senha."
        descricaoNaoConfigurado="Envio de e-mail não configurado neste ambiente."
        buscarStatus={buscarStatusResend}
        detalhes={(status) => (status.from ? [{ label: "Remetente", valor: status.from }] : [])}
      />
    ),
  },
  {
    id: "imagekit",
    nome: "ImageKit",
    funcao: "Imagens",
    papel: "Guarda e entrega as fotos dos produtos.",
    icone: ImageIcon,
    cartao: (
      <IntegracaoStatusCard
        titulo="ImageKit"
        descricaoConfigurado="Upload e CDN de imagens de produto ativos."
        descricaoNaoConfigurado="Upload e CDN de imagens de produto não configurados neste ambiente."
        buscarStatus={buscarStatusImagekit}
        verificarOperacional={verificarImagekit}
        detalhes={(status) => (status.urlEndpoint ? [{ label: "URL Endpoint", valor: status.urlEndpoint }] : [])}
      />
    ),
  },
];

// Verificação real sob demanda (GET só-leitura) — Resend não tem, igual ao
// cartão dele.
const VERIFICAR: Partial<Record<IdIntegracao, () => Promise<VerificacaoOperacionalResponse>>> = {
  asaas: verificarAsaas,
  "melhor-envio": verificarMelhorEnvio,
  imagekit: verificarImagekit,
};

/* ------------------------------------------------------------------ */
/* Status resumido (só as rotas de STATUS; nunca "Verificar agora").    */
/* Melhor Envio só conta como pronto se também estiver CONECTADO.       */
/* ------------------------------------------------------------------ */

type Situacao = "pronto" | "pendente" | "desconhecido";

type StatusGeral = {
  situacoes: Record<IdIntegracao, Situacao>;
  // Asaas: deduzido SÓ da URL base (a chave não é consultada) — por isso o
  // texto diz "URL de ...", não afirma o ambiente da conta.
  ambientes: Partial<Record<IdIntegracao, string>>;
  /** Por que está pendente/sem status, em uma frase. */
  motivos: Partial<Record<IdIntegracao, string>>;
  /** Uma informação útil e não secreta por serviço (remetente, CDN...). */
  extras: Partial<Record<IdIntegracao, string>>;
  carregando: boolean;
  atualizadoEm: Date | null;
};

const STATUS_INICIAL: StatusGeral = {
  situacoes: { asaas: "desconhecido", "melhor-envio": "desconhecido", resend: "desconhecido", imagekit: "desconhecido" },
  ambientes: {},
  motivos: {},
  extras: {},
  carregando: true,
  atualizadoEm: null,
};

function useStatus(): StatusGeral & { recarregar: () => void } {
  const [versao, setVersao] = useState(0);
  const [status, setStatus] = useState<StatusGeral>(STATUS_INICIAL);

  useEffect(() => {
    let cancelado = false;
    Promise.allSettled([
      buscarStatusAsaas(),
      buscarStatusMelhorEnvio(),
      buscarStatusResend(),
      buscarStatusImagekit(),
    ]).then(([asaas, me, resend, imagekit]) => {
      if (cancelado) return;
      const sit = (r: PromiseSettledResult<{ configured: boolean }>, extra = true): Situacao =>
        r.status === "fulfilled" ? (r.value.configured && extra ? "pronto" : "pendente") : "desconhecido";
      const motivo = (r: PromiseSettledResult<{ configured: boolean }>) =>
        r.status === "rejected"
          ? "Não foi possível consultar o status agora."
          : r.value.configured
            ? undefined
            : "Credenciais não configuradas neste ambiente.";
      const a = asaas.status === "fulfilled" ? asaas.value : undefined;
      const m = me.status === "fulfilled" ? me.value : undefined;
      const r = resend.status === "fulfilled" ? resend.value : undefined;
      const i = imagekit.status === "fulfilled" ? imagekit.value : undefined;
      const hostDe = (url?: string) => {
        try {
          return url ? new URL(url).host : undefined;
        } catch {
          return url;
        }
      };
      setStatus({
        situacoes: {
          asaas: sit(asaas),
          "melhor-envio": sit(me, m ? m.conectado : true),
          resend: sit(resend),
          imagekit: sit(imagekit),
        },
        ambientes: {
          asaas: a?.baseUrl ? (a.baseUrl.includes("sandbox") ? "URL de Sandbox" : "URL de Produção") : undefined,
          "melhor-envio": m ? (m.ambiente === "production" ? "Produção" : "Sandbox") : undefined,
        },
        motivos: {
          asaas: motivo(asaas),
          "melhor-envio":
            m && m.configured && !m.conectado ? "Configurado, mas a conta da loja ainda não foi conectada." : motivo(me),
          resend: motivo(resend),
          imagekit: motivo(imagekit),
        },
        extras: {
          asaas: a?.gatewayAtivo ? `Gateway ativo: ${a.gatewayAtivo}` : undefined,
          "melhor-envio": m?.expiresAt
            ? `Conexão válida até ${new Date(m.expiresAt).toLocaleDateString("pt-BR")}`
            : undefined,
          resend: r?.from ? `Remetente: ${r.from}` : undefined,
          imagekit: i?.urlEndpoint ? `CDN: ${hostDe(i.urlEndpoint)}` : undefined,
        },
        carregando: false,
        atualizadoEm: new Date(),
      });
    });
    return () => {
      cancelado = true;
    };
  }, [versao]);

  return {
    ...status,
    recarregar: () => {
      setStatus((atual) => ({ ...atual, carregando: true }));
      setVersao((v) => v + 1);
    },
  };
}

const SITUACAO_TEXTO: Record<Situacao, string> = {
  pronto: "Pronto",
  pendente: "Pendente",
  desconhecido: "Sem status",
};

function SeloSituacao({ situacao }: { situacao: Situacao }) {
  const estilo =
    situacao === "pronto"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : situacao === "pendente"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-slate-100 text-slate-500 ring-slate-200";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium ring-1 ${estilo}`}>
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          situacao === "pronto" ? "bg-emerald-500" : situacao === "pendente" ? "bg-amber-500" : "bg-slate-400"
        }`}
      />
      {SITUACAO_TEXTO[situacao]}
    </span>
  );
}

/** Painel lateral à direita com o cartão completo. Fecha pelo X, clicando
 *  fora ou com Esc. */
function PainelDetalhes({ onFechar, children }: { onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Detalhes da integração">
      <button type="button" aria-label="Fechar detalhes" className="absolute inset-0 bg-slate-900/40" onClick={onFechar} />
      <div className="relative ml-auto h-full w-full max-w-lg overflow-y-auto bg-slate-50 p-4 shadow-2xl sm:rounded-xl">
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-500 hover:bg-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pt-8">{children}</div>
      </div>
    </div>
  );
}

type Teste = { estado: "testando" } | { estado: "ok" | "falha"; mensagem?: string; em: Date };

function hora(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function IntegracoesQuadro() {
  const { situacoes, ambientes, motivos, extras, carregando, atualizadoEm, recarregar } = useStatus();
  const [detalhe, setDetalhe] = useState<IdIntegracao | null>(null);
  const [testes, setTestes] = useState<Partial<Record<IdIntegracao, Teste>>>({});

  async function testar(id: IdIntegracao) {
    const verificar = VERIFICAR[id];
    if (!verificar) return;
    setTestes((t) => ({ ...t, [id]: { estado: "testando" } }));
    try {
      const r = await verificar();
      setTestes((t) => ({ ...t, [id]: { estado: r.operational ? "ok" : "falha", mensagem: r.mensagem, em: new Date() } }));
    } catch {
      setTestes((t) => ({ ...t, [id]: { estado: "falha", mensagem: "Não foi possível testar agora.", em: new Date() } }));
    }
  }

  const prontas = INTEGRACOES.filter((i) => situacoes[i.id] === "pronto").length;
  const cartaoAberto = INTEGRACOES.find((i) => i.id === detalhe)?.cartao;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Resumo em uma linha */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${
                carregando ? "bg-slate-300" : prontas === INTEGRACOES.length ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {carregando ? "Consultando integrações…" : `${prontas} de ${INTEGRACOES.length} integrações prontas`}
          </span>
          {!carregando && atualizadoEm && <span className="text-slate-400">· consultado às {hora(atualizadoEm)}</span>}
          <button
            type="button"
            onClick={recarregar}
            disabled={carregando}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {INTEGRACOES.map(({ id, nome, funcao, papel, icone: Icone }) => {
            const situacao = situacoes[id];
            const teste = testes[id];
            const tom =
              carregando || situacao === "desconhecido"
                ? { cabecalho: "bg-slate-50", icone: "bg-white text-slate-500", borda: "border-slate-200" }
                : situacao === "pronto"
                  ? { cabecalho: "bg-emerald-50", icone: "bg-white text-emerald-700", borda: "border-emerald-200" }
                  : { cabecalho: "bg-amber-50", icone: "bg-white text-amber-700", borda: "border-amber-200" };
            const info = [ambientes[id], extras[id]].filter(Boolean).join(" · ");

            return (
              <article key={id} className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${tom.borda}`}>
                <header className={`flex items-center gap-4 px-5 py-4 ${tom.cabecalho}`}>
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm ${tom.icone}`}>
                    <Icone className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-slate-900">{nome}</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{funcao}</p>
                  </div>
                  {carregando ? (
                    <span className="h-6 w-20 animate-pulse rounded-full bg-white" />
                  ) : (
                    <SeloSituacao situacao={situacao} />
                  )}
                </header>

                <div className="flex flex-1 flex-col gap-3 px-5 py-4">
                  <p className="text-sm text-slate-600">{papel}</p>
                  {!carregando && motivos[id] && <p className="text-sm font-medium text-amber-700">{motivos[id]}</p>}
                  {!carregando && info && (
                    <p className="truncate text-xs text-slate-400" title={info}>
                      {info}
                    </p>
                  )}
                  {teste && teste.estado !== "testando" && (
                    <p
                      role="status"
                      className={`rounded-lg px-3 py-2 text-xs ${
                        teste.estado === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {teste.estado === "ok" ? "Conexão testada: respondeu normalmente" : teste.mensagem || "O teste falhou."}{" "}
                      <span className="opacity-60">({hora(teste.em)})</span>
                    </p>
                  )}
                </div>

                <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
                  {VERIFICAR[id] ? (
                    <button
                      type="button"
                      onClick={() => testar(id)}
                      disabled={teste?.estado === "testando" || carregando}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-navy hover:text-brand-navy disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${teste?.estado === "testando" ? "animate-spin" : ""}`} />
                      {teste?.estado === "testando" ? "Testando…" : "Testar conexão"}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Validado com envio real</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetalhe(id)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline"
                  >
                    Detalhes
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      </div>

      {cartaoAberto && <PainelDetalhes onFechar={() => setDetalhe(null)}>{cartaoAberto}</PainelDetalhes>}
    </>
  );
}
