"use client";

// Etapa 2 (Minha Conta / Detalhes + Acompanhar Pedido) — GET
// /pedidos/meus/:id (services/pedidos.ts#buscarMeuPedido). Ownership é
// resolvido inteiramente no backend (PedidosService.findOne, reaproveitado
// sem alteração): pedido inexistente e pedido de outro usuário devolvem o
// MESMO 404 genérico, então esta página trata os dois casos de forma
// idêntica — nunca tenta adivinhar qual dos dois aconteceu (evita
// enumeração de IDs).
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { isAxiosError } from "axios";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import EmptyState from "@/components/ui/EmptyState";
import FormButton from "@/components/ui/FormButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import { BackLink } from "@/components/conta/AccountPageHeader";
import StatusPedidoBadge from "@/components/conta/StatusPedidoBadge";
import AcompanhamentoPedido from "@/components/conta/AcompanhamentoPedido";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  buscarMeuPedido,
  cancelarMeuPedido,
  solicitarReembolsoMeuPedido,
} from "@/services/pedidos";
import { ROUTES } from "@/lib/routes";
import { StatusPedido, type Pedido, type PedidoComItensDetalhado } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Etapa 6.5 (Frete) — o pedido só "tem endereço" para exibição quando os
// campos essenciais do snapshot vieram preenchidos. Nunca renderiza um
// endereço pela metade: pedidos legados (anteriores à Etapa 6.5) têm todos
// esses campos ausentes (nunca parcialmente preenchidos), então esta
// checagem já cobre os dois casos reais sem precisar de um caso "parcial"
// artificial. `enderecoComplemento` fica de fora de propósito — é opcional
// mesmo num endereço completo (ver Endereco.complemento).
function possuiEnderecoCompleto(pedido: Pedido): boolean {
  return Boolean(
    pedido.enderecoCep &&
      pedido.enderecoRua &&
      pedido.enderecoNumero &&
      pedido.enderecoBairro &&
      pedido.enderecoCidade &&
      pedido.enderecoEstado,
  );
}

export default function MeuPedidoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);
  const toast = useToast();

  const [dados, setDados] = useState<PedidoComItensDetalhado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [modalCancelarAberto, setModalCancelarAberto] = useState(false);
  const [modalReembolsoAberto, setModalReembolsoAberto] = useState(false);
  const [solicitandoReembolso, setSolicitandoReembolso] = useState(false);

  useEffect(() => {
    // Id fora da URL não é um número válido — mesmo resultado prático de um
    // pedido inexistente, sem depender de como o backend reagiria a um path
    // param malformado (mesmo raciocínio já usado no detalhe do Admin).
    if (!Number.isInteger(pedidoId)) {
      setNaoEncontrado(true);
      setCarregando(false);
      return;
    }

    buscarMeuPedido(pedidoId)
      .then(setDados)
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 404) {
          setNaoEncontrado(true);
        } else {
          toast.error(getErrorMessage(err, "Não foi possível carregar o pedido."));
        }
      })
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  // Etapa 5A (Cancelamento de Pedido) — só chamado quando o status já
  // exibido é PENDENTE (botão só existe nesse caso, ver abaixo), mas o
  // backend é sempre a autoridade real: se o status mudou entre o
  // carregamento da página e o clique (ex.: webhook confirmou o pagamento
  // nesse meio tempo), a API rejeita e o erro específico do backend é
  // mostrado, sem fingir sucesso.
  //
  // Etapa 6.1 (Refinamento) — a confirmação passou de `window.confirm`
  // (diálogo nativo do navegador) para o mesmo ConfirmDialog usado pelo
  // fluxo de reembolso abaixo: só troca a UI de confirmação, a lógica de
  // negócio (endpoint, condição de exibição, mensagens) é exatamente a
  // mesma de antes.
  function handleAbrirModalCancelar() {
    setModalCancelarAberto(true);
  }

  function handleFecharModalCancelar() {
    if (cancelando) return;
    setModalCancelarAberto(false);
  }

  async function handleConfirmarCancelar() {
    if (!dados || cancelando) return;

    setCancelando(true);
    try {
      const pedidoCancelado = await cancelarMeuPedido(dados.pedido.id);
      setDados((atual) => (atual ? { ...atual, pedido: pedidoCancelado } : atual));
      setModalCancelarAberto(false);
      toast.success("Pedido cancelado com sucesso.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível cancelar o pedido."));
    } finally {
      setCancelando(false);
    }
  }

  // Etapa 5B.7 (Solicitação de Reembolso) — fluxo distinto do cancelamento
  // PENDENTE acima: só chamado quando o status já exibido é PAGO (botão só
  // existe nesse caso), sempre atrás de uma confirmação explícita (nunca
  // dispara o POST direto no clique). O backend só devolve
  // REEMBOLSO_SOLICITADO na resposta de sucesso — nunca REEMBOLSADO, que só
  // chega depois via GET, quando o webhook PAYMENT_REFUNDED (Etapa 5B.5)
  // já tiver confirmado do lado do backend.
  function handleAbrirModalReembolso() {
    setModalReembolsoAberto(true);
  }

  function handleFecharModalReembolso() {
    if (solicitandoReembolso) return;
    setModalReembolsoAberto(false);
  }

  async function handleConfirmarReembolso() {
    if (!dados || solicitandoReembolso) return;

    setSolicitandoReembolso(true);
    try {
      const pedidoAtualizado = await solicitarReembolsoMeuPedido(dados.pedido.id);
      setDados((atual) => (atual ? { ...atual, pedido: pedidoAtualizado } : atual));
      setModalReembolsoAberto(false);
      toast.success("Solicitação de reembolso enviada para processamento.");
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        // Conflito de estado: o pedido pode ter mudado entre o carregamento
        // da página e o clique (outra aba, webhook que já processou nesse
        // meio tempo) — busca o estado real do backend em vez de deixar a
        // tela mostrando um botão que já não é mais válido.
        toast.error(
          getErrorMessage(
            err,
            "O pedido não está mais disponível para solicitação de reembolso.",
          ),
        );
        setModalReembolsoAberto(false);
        buscarMeuPedido(dados.pedido.id)
          .then(setDados)
          .catch(() => {
            // Falha ao rebuscar não é crítica aqui: a tela só fica com o
            // status anterior por mais um instante, até o usuário recarregar.
          });
      } else {
        // Cobre 404/422 (mensagem específica do backend, via
        // getErrorMessage) e 5xx/timeout/rede (fallback genérico) — nunca
        // afirma que o reembolso foi recusado quando o erro é ambíguo
        // (ex.: AsaasIndisponivelError no backend mantém
        // REEMBOLSO_SOLICITADO de propósito).
        toast.error(
          getErrorMessage(
            err,
            "Não foi possível concluir a solicitação neste momento. Tente novamente.",
          ),
        );
      }
    } finally {
      setSolicitandoReembolso(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 pt-28 pb-24 sm:pt-36 sm:pb-32 lg:px-10">
      {/* Item 5/6/19 da Etapa 6.1 — sempre visível, mesmo durante
          loading/"não encontrado" (nunca depende dos dados do pedido já
          terem chegado). Volta para a LISTA (/conta/pedidos), não para
          /conta: é a página imediatamente anterior na navegação. */}
      <BackLink href={ROUTES.CONTA_PEDIDOS} label="Voltar para Meus Pedidos" />

      {carregando ? (
        <div className="mt-8 flex flex-col gap-8" aria-busy="true">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-9 w-56" />
            </div>
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
          <Skeleton className="h-16 w-full rounded-sm" />
          <Skeleton className="h-48 w-full rounded-sm" />
        </div>
      ) : naoEncontrado || !dados ? (
        <div className="mt-4">
          <EmptyState
            eyebrow="Pedidos"
            title="Pedido não encontrado"
            message="Esse pedido não existe ou não pertence à sua conta."
          />
        </div>
      ) : (
        <RevealOnScroll>
          <div className="mt-8 flex flex-col gap-2 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
                Pedido {dados.pedido.numero}
              </p>
              <h1 className="mt-2 font-serif text-3xl font-normal tracking-tight text-brand-navy sm:text-4xl">
                {new Date(dados.pedido.data).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <StatusPedidoBadge status={dados.pedido.status} />
              {dados.pedido.status === StatusPedido.PENDENTE && (
                <FormButton type="button" variant="danger" onClick={handleAbrirModalCancelar}>
                  Cancelar pedido
                </FormButton>
              )}
              {/* Etapa 5B.7 — ação de reembolso é exclusiva de PAGO: nunca
                  aparece para PENDENTE/CANCELADO (fluxo acima) nem para
                  REEMBOLSO_SOLICITADO/REEMBOLSADO (já solicitado/concluído,
                  nunca uma segunda solicitação pela interface). */}
              {dados.pedido.status === StatusPedido.PAGO && (
                <FormButton
                  type="button"
                  variant="danger"
                  onClick={handleAbrirModalReembolso}
                >
                  Solicitar reembolso
                </FormButton>
              )}
            </div>
          </div>

          {dados.pedido.status === StatusPedido.REEMBOLSO_SOLICITADO && (
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Sua solicitação de reembolso foi recebida e está em
              processamento.
            </p>
          )}

          <div className="mt-8">
            <h2 className="font-serif text-xl font-normal text-brand-navy">
              Acompanhamento
            </h2>
            <div className="mt-4">
              <AcompanhamentoPedido status={dados.pedido.status} />
            </div>
          </div>

          <div className="mt-10">
            <h2 className="font-serif text-xl font-normal text-brand-navy">
              Itens do pedido
            </h2>
            <ul className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
              {dados.itens.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-4 transition-colors duration-200 hover:bg-slate-50/80"
                >
                  <div>
                    <p className="text-sm font-medium text-brand-navy">{item.produtoNome}</p>
                    <p className="text-sm text-slate-500">
                      {item.quantidade} × {formatPrice.format(item.precoUnitario)}
                    </p>
                  </div>
                  <p className="font-medium tabular-nums text-brand-navy">
                    {formatPrice.format(item.subtotal)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-base">
              <p className="font-semibold text-brand-navy">Total</p>
              <p className="text-lg font-semibold tabular-nums text-brand-navy">
                {formatPrice.format(dados.total)}
              </p>
            </div>
          </div>

          <div className="mt-10">
            <h2 className="font-serif text-xl font-normal text-brand-navy">
              Endereço de entrega
            </h2>
            {/* Etapa 6.5 (Frete) — snapshot do endereço usado NESTE pedido
                (Pedido.enderecoCep/Rua/Numero/..., preenchido pelo checkout
                a partir da Etapa 6.5), nunca o cadastro atual do cliente —
                um pedido antigo continua mostrando o mesmo endereço para
                onde foi enviado, mesmo que o cliente edite/exclua o
                endereço na conta depois. Pedidos anteriores à Etapa 6.5
                nunca têm esses campos preenchidos — o fallback abaixo
                preserva exatamente a mensagem que já existia para eles. */}
            {possuiEnderecoCompleto(dados.pedido) ? (
              <address className="mt-3 text-sm leading-relaxed text-slate-600 not-italic">
                <p>
                  {dados.pedido.enderecoRua}, {dados.pedido.enderecoNumero}
                </p>
                {dados.pedido.enderecoComplemento && <p>{dados.pedido.enderecoComplemento}</p>}
                <p>{dados.pedido.enderecoBairro}</p>
                <p>
                  {dados.pedido.enderecoCidade} / {dados.pedido.enderecoEstado}
                </p>
                <p>CEP {dados.pedido.enderecoCep}</p>
              </address>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Endereço de entrega não disponível para este pedido.
              </p>
            )}
          </div>
        </RevealOnScroll>
      )}

      {dados && (
        <>
          <ConfirmDialog
            open={modalCancelarAberto}
            title="Cancelar pedido?"
            description={
              <p>
                Cancelar o pedido {dados.pedido.numero}? Esta ação não pode
                ser desfeita.
              </p>
            }
            confirmLabel="Cancelar pedido"
            confirmingLabel="Cancelando..."
            confirming={cancelando}
            onConfirm={handleConfirmarCancelar}
            onCancel={handleFecharModalCancelar}
          />
          <ConfirmDialog
            open={modalReembolsoAberto}
            title="Solicitar reembolso?"
            description={
              <>
                <p>Você está solicitando o reembolso deste pedido.</p>
                <p className="mt-2">
                  Após confirmar, a solicitação será enviada para
                  processamento.
                </p>
              </>
            }
            confirmLabel="Solicitar reembolso"
            confirmingLabel="Processando..."
            confirming={solicitandoReembolso}
            onConfirm={handleConfirmarReembolso}
            onCancel={handleFecharModalReembolso}
          />
        </>
      )}
    </div>
  );
}
