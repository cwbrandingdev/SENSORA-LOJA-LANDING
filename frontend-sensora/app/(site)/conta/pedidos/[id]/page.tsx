"use client";

// Etapa 2 (Minha Conta / Detalhes + Acompanhar Pedido) — GET
// /pedidos/meus/:id (services/pedidos.ts#buscarMeuPedido). Ownership é
// resolvido inteiramente no backend (PedidosService.findOne, reaproveitado
// sem alteração): pedido inexistente e pedido de outro usuário devolvem o
// MESMO 404 genérico, então esta página trata os dois casos de forma
// idêntica — nunca tenta adivinhar qual dos dois aconteceu (evita
// enumeração de IDs).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isAxiosError } from "axios";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import EmptyState from "@/components/ui/EmptyState";
import FormButton from "@/components/ui/FormButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import QuantityStepper from "@/components/ui/QuantityStepper";
import Skeleton from "@/components/ui/Skeleton";
import EnderecoCard from "@/components/loja/EnderecoCard";
import { BackLink } from "@/components/conta/AccountPageHeader";
import StatusPedidoBadge from "@/components/conta/StatusPedidoBadge";
import AcompanhamentoPedido from "@/components/conta/AcompanhamentoPedido";
import HistoricoDevolucoes from "@/components/conta/HistoricoDevolucoes";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  buscarMeuPedido,
  cancelarMeuPedido,
  listarMinhasDevolucoes,
  solicitarDevolucaoMeuPedido,
  solicitarReembolsoMeuPedido,
  atualizarEnderecoMeuPedido,
} from "@/services/pedidos";
import { listarEnderecos } from "@/services/enderecos";
import { normalizarCep } from "@/lib/cep";
import { ROUTES } from "@/lib/routes";
import { ROTAS_LEGAIS } from "@/lib/empresa";
import {
  StatusEnvio,
  StatusPedido,
  type DevolucoesDoPedido,
  type Endereco,
  type Pedido,
  type PedidoComItensDetalhado,
} from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Mesmo estilo de campo das outras telas da conta (ex.: /conta/seguranca).
const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-colors duration-200 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";

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

  // Etapa 4 (Devoluções) — formulário da devolução. `quantidadesDevolucao`
  // guarda, por id do item do pedido, quantas unidades devolver (0 ou
  // ausente = item não selecionado).
  const [modalDevolucaoAberto, setModalDevolucaoAberto] = useState(false);
  const [enviandoDevolucao, setEnviandoDevolucao] = useState(false);
  const [quantidadesDevolucao, setQuantidadesDevolucao] = useState<Record<number, number>>({});
  const [motivoDevolucao, setMotivoDevolucao] = useState("");
  const [descricaoDevolucao, setDescricaoDevolucao] = useState("");
  const [erroDevolucao, setErroDevolucao] = useState<string | null>(null);
  // Etapa 6 — histórico de devoluções e saldo de cada item, vindos do
  // backend (fonte da verdade; a tela não recalcula o saldo).
  const [devolucoesDoPedido, setDevolucoesDoPedido] = useState<DevolucoesDoPedido | null>(
    null,
  );
  const [modalEnderecoAberto, setModalEnderecoAberto] = useState(false);
  const [enderecosConta, setEnderecosConta] = useState<Endereco[]>([]);
  const [enderecoEscolhidoId, setEnderecoEscolhidoId] = useState<number | null>(null);
  const [salvandoEndereco, setSalvandoEndereco] = useState(false);

  // Só pedido PAGO já ENVIADO tem devolução; para os outros, não busca nada.
  async function carregarDevolucoes(pedido: Pedido) {
    if (pedido.status !== StatusPedido.PAGO || pedido.statusEnvio !== StatusEnvio.ENVIADO) {
      setDevolucoesDoPedido(null);
      return;
    }
    try {
      setDevolucoesDoPedido(await listarMinhasDevolucoes(pedido.id));
    } catch (err) {
      toast.error(
        getErrorMessage(err, "Não foi possível carregar as devoluções deste pedido."),
      );
    }
  }

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
      .then(async (resultado) => {
        setDados(resultado);
        await carregarDevolucoes(resultado.pedido);
      })
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

  async function handleAbrirModalEndereco() {
    if (!dados) return;
    try {
      const lista = await listarEnderecos();
      setEnderecosConta(lista);
      setEnderecoEscolhidoId(null);
      setModalEnderecoAberto(true);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível carregar seus endereços."));
    }
  }

  function handleFecharModalEndereco() {
    if (salvandoEndereco) return;
    setModalEnderecoAberto(false);
  }

  async function handleConfirmarEndereco() {
    if (!dados || !enderecoEscolhidoId || salvandoEndereco) return;
    setSalvandoEndereco(true);
    try {
      const pedidoAtualizado = await atualizarEnderecoMeuPedido(
        dados.pedido.id,
        enderecoEscolhidoId,
      );
      setDados((atual) => (atual ? { ...atual, pedido: pedidoAtualizado } : atual));
      setModalEnderecoAberto(false);
      toast.success("Endereço de entrega atualizado.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível alterar o endereço."));
    } finally {
      setSalvandoEndereco(false);
    }
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

  // Etapa 4 (Devoluções) — só para pedido PAGO já ENVIADO (botão só existe
  // nesse caso). O limite de quantidade na tela é o saldo informado pelo
  // backend (Etapa 6); ainda assim a criação é validada de novo lá, e a
  // mensagem dele aparece no próprio formulário.
  function handleAbrirModalDevolucao() {
    setQuantidadesDevolucao({});
    setMotivoDevolucao("");
    setDescricaoDevolucao("");
    setErroDevolucao(null);
    setModalDevolucaoAberto(true);
  }

  function handleFecharModalDevolucao() {
    if (enviandoDevolucao) return;
    setModalDevolucaoAberto(false);
  }

  function alterarQuantidadeDevolucao(itemId: number, quantidade: number) {
    setQuantidadesDevolucao((atual) => ({ ...atual, [itemId]: quantidade }));
  }

  async function handleConfirmarDevolucao() {
    if (!dados || enviandoDevolucao) return;

    const itens = dados.itens
      .filter((item) => (quantidadesDevolucao[item.id] ?? 0) > 0)
      .map((item) => ({
        itemPedidoId: item.id,
        quantidade: quantidadesDevolucao[item.id],
      }));
    const motivo = motivoDevolucao.trim();

    if (itens.length === 0) {
      setErroDevolucao("Selecione pelo menos um item para devolver.");
      return;
    }
    if (!motivo) {
      setErroDevolucao("Informe o motivo da devolução.");
      return;
    }

    setErroDevolucao(null);
    setEnviandoDevolucao(true);
    try {
      await solicitarDevolucaoMeuPedido(dados.pedido.id, {
        motivo,
        descricao: descricaoDevolucao.trim() || undefined,
        itens,
      });
      setModalDevolucaoAberto(false);
      toast.success("Solicitação de devolução registrada. Você pode enviar fotos abaixo.");
      // O histórico recarregado já traz a nova devolução (com as fotos
      // editáveis) e o saldo atualizado dos itens.
      await carregarDevolucoes(dados.pedido);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        // O pedido mudou de situação (ex.: reembolso em andamento) — fecha
        // o formulário e busca o estado atual, como no fluxo de reembolso.
        toast.error(
          getErrorMessage(err, "Este pedido não está mais disponível para devolução."),
        );
        setModalDevolucaoAberto(false);
        buscarMeuPedido(dados.pedido.id)
          .then(async (resultado) => {
            setDados(resultado);
            await carregarDevolucoes(resultado.pedido);
          })
          .catch(() => {});
      } else {
        // Ex.: quantidade acima do saldo disponível — mostra a mensagem do
        // backend no formulário, para o cliente ajustar e tentar de novo.
        setErroDevolucao(
          getErrorMessage(
            err,
            "Não foi possível registrar a devolução neste momento. Tente novamente.",
          ),
        );
      }
    } finally {
      setEnviandoDevolucao(false);
    }
  }

  const pedidoEnviado = dados?.pedido.statusEnvio === StatusEnvio.ENVIADO;
  // Saldo de cada item (itemPedidoId -> quantidade que ainda pode voltar).
  const saldoPorItem = new Map(
    (devolucoesDoPedido?.itensDisponiveis ?? []).map((item) => [
      item.itemPedidoId,
      item.quantidadeDisponivel,
    ]),
  );
  const temSaldoParaDevolver = [...saldoPorItem.values()].some((saldo) => saldo > 0);

  return (
    <div className="mx-auto max-w-4xl px-6 pt-8 pb-24 sm:pb-32 lg:px-10">
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
                {/* Achado da investigação do Editar pedido PENDENTE (Etapa
                    6.6, Lote 1/2) — `pedido.data` é meia-noite UTC; sem
                    `timeZone: "UTC"`, toLocaleDateString converte para o
                    fuso local do navegador e pode exibir o dia anterior.
                    Mesma correção aplicada em
                    components/tables/PedidoTable.tsx (Admin) e em
                    /conta/pedidos (lista). */}
                {new Date(dados.pedido.data).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
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
              {/* Etapa 4 (Devoluções) — PAGO ainda não enviado continua com
                  o reembolso; PAGO já enviado passa a pedir devolução. */}
              {dados.pedido.status === StatusPedido.PAGO && !pedidoEnviado && (
                <FormButton
                  type="button"
                  variant="danger"
                  onClick={handleAbrirModalReembolso}
                >
                  Solicitar reembolso
                </FormButton>
              )}
              {/* Etapa 6 — some quando nenhum item tem saldo (ou enquanto
                  o saldo não foi carregado). */}
              {dados.pedido.status === StatusPedido.PAGO &&
                pedidoEnviado &&
                temSaldoParaDevolver && (
                  <FormButton type="button" onClick={handleAbrirModalDevolucao}>
                    Solicitar devolução
                  </FormButton>
                )}
            </div>
          </div>

          {devolucoesDoPedido && devolucoesDoPedido.devolucoes.length > 0 && (
            <HistoricoDevolucoes
              pedidoId={dados.pedido.id}
              devolucoes={devolucoesDoPedido.devolucoes}
              itensPedido={dados.itens}
            />
          )}

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
              <AcompanhamentoPedido
                status={dados.pedido.status}
                statusEnvio={dados.pedido.statusEnvio}
                enviadoEm={dados.pedido.enviadoEm}
                codigoRastreio={dados.pedido.codigoRastreio}
              />
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
              <>
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
                {dados.pedido.status === StatusPedido.PAGO && !pedidoEnviado && (
                  <FormButton
                    type="button"
                    variant="secondary"
                    className="mt-4"
                    onClick={handleAbrirModalEndereco}
                  >
                    Alterar endereço
                  </FormButton>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Endereço de entrega não disponível para este pedido.
              </p>
            )}
          </div>

          <p className="mt-10 text-sm leading-relaxed text-slate-600">
            Você pode desistir em 7 dias após o recebimento, ou acionar a
            garantia de 30 dias se o produto vier com defeito.{" "}
            <Link
              href={ROTAS_LEGAIS.trocas}
              className="text-brand-navy underline underline-offset-4"
            >
              Trocas e devoluções
            </Link>
            .
          </p>
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
          <ConfirmDialog
            open={modalDevolucaoAberto}
            title="Solicitar devolução"
            description={
              <div className="flex flex-col gap-4">
                <p>Selecione os itens e a quantidade que deseja devolver.</p>

                <ul className="max-h-60 divide-y divide-slate-200 overflow-y-auto border-y border-slate-200">
                  {dados.itens.map((item) => {
                    const quantidade = quantidadesDevolucao[item.id] ?? 0;
                    const selecionado = quantidade > 0;
                    // Saldo calculado no backend (comprado menos o que já
                    // está em outras devoluções).
                    const saldo = saldoPorItem.get(item.id) ?? 0;
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                        <label
                          className={`flex items-center gap-3 ${saldo === 0 ? "text-slate-400" : "text-brand-navy"}`}
                        >
                          <input
                            type="checkbox"
                            checked={selecionado}
                            onChange={() =>
                              alterarQuantidadeDevolucao(item.id, selecionado ? 0 : 1)
                            }
                            disabled={enviandoDevolucao || saldo === 0}
                            className="h-4 w-4 accent-brand-navy"
                          />
                          <span>
                            <span className="block font-medium">{item.produtoNome}</span>
                            <span className="block text-xs text-slate-500">
                              {saldo > 0
                                ? `Disponível para devolução: ${saldo} de ${item.quantidade}`
                                : "Já incluído em outra devolução"}
                            </span>
                          </span>
                        </label>
                        {selecionado && (
                          <QuantityStepper
                            value={quantidade}
                            min={1}
                            max={saldo}
                            disabled={enviandoDevolucao}
                            onIncrease={() =>
                              alterarQuantidadeDevolucao(item.id, Math.min(quantidade + 1, saldo))
                            }
                            onDecrease={() =>
                              alterarQuantidadeDevolucao(item.id, Math.max(quantidade - 1, 1))
                            }
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>

                <label className="flex flex-col gap-1">
                  <span className="font-medium text-slate-700">Motivo</span>
                  <input
                    type="text"
                    value={motivoDevolucao}
                    onChange={(event) => setMotivoDevolucao(event.target.value)}
                    maxLength={200}
                    disabled={enviandoDevolucao}
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="font-medium text-slate-700">Descrição (opcional)</span>
                  <textarea
                    value={descricaoDevolucao}
                    onChange={(event) => setDescricaoDevolucao(event.target.value)}
                    maxLength={2000}
                    rows={3}
                    disabled={enviandoDevolucao}
                    className={inputClass}
                  />
                </label>

                {erroDevolucao && (
                  <p role="alert" className="text-sm text-red-600">
                    {erroDevolucao}
                  </p>
                )}
              </div>
            }
            confirmLabel="Enviar solicitação"
            confirmingLabel="Enviando..."
            confirmVariant="primary"
            confirming={enviandoDevolucao}
            onConfirm={handleConfirmarDevolucao}
            onCancel={handleFecharModalDevolucao}
          />
          <ConfirmDialog
            open={modalEnderecoAberto}
            title="Alterar endereço de entrega"
            description={
              <div className="flex flex-col gap-3">
                <p>
                  Só endereços no mesmo CEP do frete já pago. Para outro CEP,
                  cadastre o endereço em{" "}
                  <Link
                    href={ROUTES.CONTA_ENDERECOS}
                    className="text-brand-navy underline underline-offset-4"
                  >
                    Minha Conta → Endereços
                  </Link>
                  .
                </p>
                {enderecosConta.filter(
                  (endereco) =>
                    normalizarCep(endereco.cep) ===
                    normalizarCep(dados.pedido.enderecoCep ?? ""),
                ).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum outro endereço cadastrado neste CEP.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2" role="radiogroup">
                    {enderecosConta
                      .filter(
                        (endereco) =>
                          normalizarCep(endereco.cep) ===
                          normalizarCep(dados.pedido.enderecoCep ?? ""),
                      )
                      .map((endereco) => (
                        <EnderecoCard
                          key={endereco.id}
                          endereco={endereco}
                          selecionado={enderecoEscolhidoId === endereco.id}
                          onSelecionar={() => setEnderecoEscolhidoId(endereco.id)}
                        />
                      ))}
                  </div>
                )}
              </div>
            }
            confirmLabel="Usar este endereço"
            confirmingLabel="Salvando..."
            confirmVariant="primary"
            confirming={salvandoEndereco}
            onConfirm={handleConfirmarEndereco}
            onCancel={handleFecharModalEndereco}
          />
        </>
      )}
    </div>
  );
}
