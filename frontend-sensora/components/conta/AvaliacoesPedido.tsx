"use client";

// Página do pedido (Minha Conta): avaliação de cada produto. Só para pedido
// pago e já enviado, e a partir da data prevista de entrega (envio + prazo
// do frete, calculada pelo backend) ou antes, quando o cliente clica em
// "Recebi meu pedido". Vai para a loja depois da aprovação do Admin.
import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import Estrelas from "@/components/loja/Estrelas";
import FormButton from "@/components/ui/FormButton";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  StatusEnvio,
  StatusPedido,
  type AvaliacaoDoCliente,
  type ItemPedidoDetalhado,
  type Pedido,
  type StatusAvaliacao,
} from "@/lib/types/loja";
import { listarAvaliacoesDoPedido, salvarAvaliacao } from "@/services/avaliacoes";
import { confirmarRecebimentoMeuPedido } from "@/services/pedidos";

const MAXIMO_COMENTARIO = 2000;

const SITUACAO: Record<StatusAvaliacao, { texto: string; classe: string }> = {
  PENDENTE: { texto: "Em análise — aparece na loja depois de aprovada", classe: "text-amber-700" },
  APROVADA: { texto: "Publicada na loja", classe: "text-emerald-700" },
  RECUSADA: { texto: "Não publicada", classe: "text-slate-500" },
};

type Props = {
  pedido: Pedido;
  itens: ItemPedidoDetalhado[];
  /** Pedido atualizado depois do "Recebi meu pedido" (a página mostra "Entregue"). */
  onRecebido: (pedido: Pedido) => void;
};

function FormAvaliacao({
  pedidoId,
  item,
  existente,
  onSalva,
}: {
  pedidoId: number;
  item: ItemPedidoDetalhado;
  existente?: AvaliacaoDoCliente;
  onSalva: (avaliacao: AvaliacaoDoCliente) => void;
}) {
  const toast = useToast();
  const [editando, setEditando] = useState(!existente);
  const [nota, setNota] = useState(existente?.nota ?? 0);
  const [comentario, setComentario] = useState(existente?.comentario ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (nota === 0) {
      setErro("Escolha de 1 a 5 estrelas.");
      return;
    }
    setErro("");
    setSalvando(true);
    try {
      const salva = await salvarAvaliacao(pedidoId, item.produtoId, { nota, comentario });
      onSalva(salva);
      setEditando(false);
      toast.success("Obrigado! Sua avaliação foi enviada.");
    } catch (err) {
      setErro(getErrorMessage(err, "Não foi possível enviar a avaliação."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className="py-5">
      <div className="flex items-center gap-3">
        {item.produtoImagemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.produtoImagemUrl} alt="" className="h-12 w-12 shrink-0 rounded-sm object-cover" />
        ) : (
          <span className="h-12 w-12 shrink-0 rounded-sm bg-stone-100" />
        )}
        <p className="text-sm font-medium text-brand-navy">{item.produtoNome}</p>
      </div>

      {existente && !editando ? (
        <div className="mt-3">
          <Estrelas valor={existente.nota} />
          {existente.comentario && (
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{existente.comentario}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className={SITUACAO[existente.status].classe}>{SITUACAO[existente.status].texto}</span>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-brand-navy underline underline-offset-4"
            >
              Editar avaliação
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <Estrelas valor={nota} onEscolher={setNota} tamanho="lg" />
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Conte o que achou (opcional)</span>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              maxLength={MAXIMO_COMENTARIO}
              placeholder="Aroma, intensidade, duração…"
              className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy focus:outline-none"
            />
          </label>
          {existente && (
            <p className="text-xs text-slate-500">Ao salvar, a avaliação volta para análise antes de aparecer na loja.</p>
          )}
          {erro && (
            <p role="alert" className="text-sm text-red-600">
              {erro}
            </p>
          )}
          <div className="flex gap-2">
            <FormButton type="button" onClick={salvar} disabled={salvando}>
              {salvando ? "Enviando…" : "Enviar avaliação"}
            </FormButton>
            {existente && (
              <FormButton type="button" variant="ghost" onClick={() => setEditando(false)}>
                Cancelar
              </FormButton>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export default function AvaliacoesPedido({ pedido, itens, onRecebido }: Props) {
  const toast = useToast();
  const [liberadaEm, setLiberadaEm] = useState<string | null>(null);
  // Comparado com "agora" quando a resposta chega (não durante a renderização).
  const [aCaminho, setACaminho] = useState(false);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoDoCliente[] | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const elegivel = pedido.status === StatusPedido.PAGO && pedido.statusEnvio === StatusEnvio.ENVIADO;

  useEffect(() => {
    if (!elegivel) return;
    let ativo = true;
    listarAvaliacoesDoPedido(pedido.id)
      .then((resposta) => {
        if (!ativo) return;
        setLiberadaEm(resposta.liberadaEm);
        setACaminho(resposta.liberadaEm !== null && new Date(resposta.liberadaEm).getTime() > Date.now());
        setAvaliacoes(resposta.avaliacoes);
      })
      .catch(() => ativo && setAvaliacoes([]));
    return () => {
      ativo = false;
    };
    // pedido.recebidoEm: depois do "Recebi meu pedido" busca de novo e já
    // abre a avaliação.
  }, [elegivel, pedido.id, pedido.recebidoEm]);

  async function confirmarRecebimento() {
    setConfirmando(true);
    try {
      onRecebido(await confirmarRecebimentoMeuPedido(pedido.id));
      toast.success("Que bom que chegou! Agora você já pode avaliar os produtos.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível confirmar o recebimento."));
    } finally {
      setConfirmando(false);
    }
  }

  if (!elegivel || avaliacoes === null || !liberadaEm) return null;

  // Ainda a caminho: mostra a partir de quando dá para avaliar, ou já
  // libera se o cliente confirmar que recebeu.
  if (aCaminho) {
    return (
      <div className="mt-8 flex items-start gap-3 rounded-sm border border-brand-navy/15 bg-brand-navy/[0.03] p-5">
        <Truck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-orange" />
        <div>
          <p className="font-medium text-brand-navy">Seu pedido está a caminho</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Você poderá avaliar os produtos a partir de{" "}
            {new Date(liberadaEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Já chegou? Confirme
            abaixo e avalie agora.
          </p>
          <FormButton type="button" onClick={confirmarRecebimento} disabled={confirmando} className="mt-3">
            {confirmando ? "Confirmando…" : "Recebi meu pedido"}
          </FormButton>
        </div>
      </div>
    );
  }

  // Um formulário por produto (o mesmo produto pode aparecer em mais de um item).
  const produtos = itens.filter((item, i) => itens.findIndex((o) => o.produtoId === item.produtoId) === i);

  return (
    <div className="mt-10">
      <h2 className="font-serif text-xl font-normal text-brand-navy">Avalie seus produtos</h2>
      <p className="mt-1 text-sm text-slate-500">Sua opinião ajuda outras pessoas a escolher o aroma certo.</p>
      <ul className="mt-2 divide-y divide-slate-200 border-t border-slate-200">
        {produtos.map((item) => (
          <FormAvaliacao
            key={item.produtoId}
            pedidoId={pedido.id}
            item={item}
            existente={avaliacoes.find((a) => a.produtoId === item.produtoId)}
            onSalva={(salva) =>
              setAvaliacoes((atual) => [...(atual ?? []).filter((a) => a.produtoId !== salva.produtoId), salva])
            }
          />
        ))}
      </ul>
    </div>
  );
}
