"use client";

// Sacola parada (e-mail de carrinho) e Pedido PENDENTE (e-mail de checkout)
// no mesmo painel. A equipe usa esta lista para falar com o cliente por
// WhatsApp ou e-mail — não dispara mala direta. GET /admin/checkout/pendentes;
// mesmo acesso de Pedidos (ADMIN + VENDEDOR).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Hourglass,
  Mail,
  MessageCircle,
  ShoppingBag,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/InlineErrorState";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import { formatarTelefone } from "@/lib/telefone";
import type {
  CheckoutPendenteAdmin,
  TipoAcompanhamentoAdmin,
} from "@/lib/types/loja";
import { listarCheckoutsPendentesAdmin } from "@/services/checkout";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type Filtro = "TODOS" | TipoAcompanhamentoAdmin;

function formatarQuando(data: string): string {
  return new Date(data).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatarHa(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas < 24) {
    return resto === 0 ? `${horas}h` : `${horas}h ${resto} min`;
  }
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

function formatarRestante(minutos: number): string {
  if (minutos <= 0) return "Expira agora";
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas}h`;
  return `${horas}h ${resto} min`;
}

function linkWhatsApp(item: CheckoutPendenteAdmin): string | null {
  if (!item.clienteTelefone) return null;
  const digitos = item.clienteTelefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const e164 = digitos.startsWith("55") ? digitos : `55${digitos}`;
  const nome = item.clienteNome?.trim().split(/\s+/)[0] || "olá";
  const texto =
    item.tipo === "CARRINHO"
      ? `Olá, ${nome}! Vi que você deixou itens na sacola da Sensora. Posso ajudar a finalizar?`
      : `Olá, ${nome}! Vi que você iniciou o pedido ${item.numero} na Sensora e o pagamento ainda não foi concluído. Posso ajudar?`;
  return `https://wa.me/${e164}?text=${encodeURIComponent(texto)}`;
}

function linkMailto(item: CheckoutPendenteAdmin): string | null {
  if (!item.clienteEmail) return null;
  const assunto =
    item.tipo === "CARRINHO"
      ? "Sacola na Sensora"
      : `Pagamento em aberto — pedido ${item.numero}`;
  return `mailto:${item.clienteEmail}?subject=${encodeURIComponent(assunto)}`;
}

export default function PagamentosEmAbertoPage() {
  const toast = useToast();
  const [itens, setItens] = useState<CheckoutPendenteAdmin[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("TODOS");

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      setItens(await listarCheckoutsPendentesAdmin());
    } catch (err) {
      const mensagem = getErrorMessage(
        err,
        "Não foi possível carregar quem precisa de acompanhamento.",
      );
      setErro(mensagem);
      toast.error(mensagem);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sacolas = itens?.filter((item) => item.tipo === "CARRINHO").length ?? 0;
  const pagamentos = itens?.filter((item) => item.tipo === "CHECKOUT").length ?? 0;
  const visiveis = useMemo(() => {
    if (!itens) return [];
    if (filtro === "TODOS") return itens;
    return itens.filter((item) => item.tipo === filtro);
  }, [itens, filtro]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-brand-navy">
          Para acompanhar
        </h2>
        <p className="mt-2 max-w-2xl text-base text-slate-600">
          Quem deixou a sacola parada ou começou o pagamento e não concluiu.
          E-mail e WhatsApp abrem direto daqui; o lembrete automático sai cerca
          de 1 hora depois.
        </p>
      </div>

      {loading ? (
        <ListaSkeleton />
      ) : erro ? (
        <InlineErrorState message={erro} onRetry={carregar} />
      ) : itens === null ? (
        <ListaSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <FiltroChip
              ativo={filtro === "TODOS"}
              onClick={() => setFiltro("TODOS")}
              label={`Todos (${itens.length})`}
            />
            <FiltroChip
              ativo={filtro === "CARRINHO"}
              onClick={() => setFiltro("CARRINHO")}
              label={`Sacola (${sacolas})`}
            />
            <FiltroChip
              ativo={filtro === "CHECKOUT"}
              onClick={() => setFiltro("CHECKOUT")}
              label={`Pagamento (${pagamentos})`}
            />
          </div>

          {visiveis.length === 0 ? (
            <EmptyState
              compact
              eyebrow="Acompanhar"
              title="Ninguém para acompanhar"
              message="Quando alguém deixar a sacola parada ou iniciar o checkout sem pagar, a pessoa aparece aqui."
              icon={Hourglass}
            />
          ) : (
            <ul className="flex flex-col gap-5">
              {visiveis.map((item) => (
                <CardAcompanhamento key={item.id} item={item} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function FiltroChip({
  ativo,
  onClick,
  label,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        ativo
          ? "bg-brand-navy text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function ListaSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-4 h-10 w-64" />
          <Skeleton className="mt-6 h-14 w-full" />
        </div>
      ))}
    </div>
  );
}

function CardAcompanhamento({ item }: { item: CheckoutPendenteAdmin }) {
  const nome = item.clienteNome?.trim() || "Cliente sem nome";
  const whatsapp = linkWhatsApp(item);
  const mailto = linkMailto(item);
  const telefoneFormatado = item.clienteTelefone
    ? formatarTelefone(item.clienteTelefone)
    : null;

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {item.tipo === "CARRINHO" ? (
            <Badge tone="info">Sacola parada</Badge>
          ) : (
            <Badge tone="warning">Pagamento em aberto</Badge>
          )}
          {item.lembreteEnviadoEm ? (
            <Badge tone="success" dot={false}>
              Lembrete enviado
            </Badge>
          ) : (
            <Badge tone="neutral" dot={false}>
              Lembrete ainda não
            </Badge>
          )}
        </div>
        <p className="text-2xl font-semibold tabular-nums text-brand-navy sm:text-3xl">
          {formatPrice.format(item.total)}
        </p>
      </div>

      {item.usuarioId ? (
        <Link
          href={`${ROUTES.CLIENTES}/${item.usuarioId}`}
          className="mt-4 block text-3xl font-semibold tracking-tight text-brand-navy hover:underline sm:text-4xl"
        >
          {nome}
        </Link>
      ) : (
        <p className="mt-4 text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">
          {nome}
        </p>
      )}

      {item.numero ? (
        <p className="mt-1 text-base text-slate-500">{item.numero}</p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {item.clienteEmail && mailto ? (
          <a
            href={mailto}
            className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-lg text-slate-800 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 sm:text-xl"
          >
            <Mail aria-hidden className="h-6 w-6 shrink-0 text-brand-navy" />
            <span className="min-w-0 break-all">{item.clienteEmail}</span>
          </a>
        ) : (
          <p className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-lg text-slate-400 ring-1 ring-slate-200">
            <Mail aria-hidden className="h-6 w-6 shrink-0" />
            Sem e-mail
          </p>
        )}
        {telefoneFormatado && whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-4 text-lg text-emerald-900 ring-1 ring-emerald-100 transition-colors hover:bg-emerald-100 sm:text-xl"
          >
            <MessageCircle aria-hidden className="h-6 w-6 shrink-0" />
            {telefoneFormatado}
          </a>
        ) : (
          <p className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-lg text-slate-400 ring-1 ring-slate-200">
            <MessageCircle aria-hidden className="h-6 w-6 shrink-0" />
            Sem telefone
          </p>
        )}
      </div>

      <div className="mt-6">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
          <ShoppingBag aria-hidden className="h-4 w-4" />
          No carrinho
        </p>
        {item.itens.length === 0 ? (
          <p className="mt-2 text-lg text-slate-500">Nenhum item listado</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200">
            {item.itens.map((linha) => (
              <li
                key={`${item.id}-${linha.produtoId}`}
                className="flex items-baseline justify-between gap-4 px-4 py-3 text-lg sm:text-xl"
              >
                <span className="min-w-0 text-slate-800">
                  {linha.nome}
                  <span className="ml-2 font-semibold text-slate-500">
                    × {linha.quantidade}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-slate-700">
                  {formatPrice.format(linha.preco * linha.quantidade)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <p className="inline-flex items-center gap-1.5">
          <Clock aria-hidden className="h-4 w-4" />
          Parado há {formatarHa(item.minutosParado)}
          {item.minutosRestantes != null
            ? ` · ${formatarRestante(item.minutosRestantes)} restantes`
            : null}
          <span className="text-slate-400">· {formatarQuando(item.paradoEm)}</span>
        </p>
        {item.pedidoId ? (
          <Link
            href={`${ROUTES.PEDIDOS}/${item.pedidoId}`}
            className="text-base font-medium text-brand-orange hover:underline"
          >
            Ver pedido
          </Link>
        ) : item.usuarioId ? (
          <Link
            href={`${ROUTES.CLIENTES}/${item.usuarioId}`}
            className="text-base font-medium text-brand-orange hover:underline"
          >
            Ver cliente
          </Link>
        ) : null}
      </div>
    </li>
  );
}
