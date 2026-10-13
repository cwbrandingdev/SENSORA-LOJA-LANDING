"use client";

// Etapa 8.1 (complemento — eliminação da venda manual) — esta página não
// cria mais pedidos. "Novo pedido" foi removido de propósito: a Sensora não
// tem venda manual, então a área administrativa só gerencia pedidos que já
// nasceram do fluxo real (Carrinho -> Checkout -> Asaas). O que resta aqui é
// só edição de numero/data/total, remoção, marcar como enviado e listagem —
// nunca criação de venda.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PedidoTable from "@/components/tables/PedidoTable";
import PedidoForm, { type PedidoFormValues } from "@/components/forms/PedidoForm";
import PedidosParaEnviarCard from "@/components/admin/PedidosParaEnviarCard";
import PedidosFiltros, {
  PEDIDOS_FILTROS_VAZIO,
  temFiltroAtivo,
  type PedidosFiltrosValue,
} from "@/components/admin/PedidosFiltros";
import TableSkeleton from "@/components/ui/TableSkeleton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  listarPedidos,
  atualizarPedido,
  removerPedido,
  marcarPedidoComoEnviado,
} from "@/services/pedidos";
import { StatusEnvio, StatusPedido, type Pedido } from "@/lib/types/loja";

// Filtros iniciais vindos da URL (ex.: alertas do Dashboard abrem
// ?status=REEMBOLSO_SOLICITADO ou ?status=PAGO&dataAte=AAAA-MM-DD). Valores
// desconhecidos são ignorados.
function filtrosDaUrl(params: URLSearchParams): PedidosFiltrosValue {
  const status = params.get("status");
  const dataAte = params.get("dataAte");
  return {
    ...PEDIDOS_FILTROS_VAZIO,
    ...(status && (Object.values(StatusPedido) as string[]).includes(status)
      ? { status: status as StatusPedido }
      : {}),
    ...(dataAte && /^\d{4}-\d{2}-\d{2}$/.test(dataAte) ? { dataAte } : {}),
  };
}

// useSearchParams exige um limite de Suspense no App Router (mesmo padrão
// de app/confirmar-email/page.tsx).
export default function PedidosPage() {
  return (
    <Suspense fallback={null}>
      <PedidosConteudo />
    </Suspense>
  );
}

function PedidosConteudo() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  // Refinamento visual (Admin) — eco persistente do erro (o toast some só;
  // isto fica até um novo carregamento com sucesso), com ação de retry.
  // Aditivo: o toast de erro já existente em carregarPedidos() continua
  // disparando exatamente como antes.
  const [erro, setErro] = useState<string | null>(null);
  const [editingPedido, setEditingPedido] = useState<Pedido | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  // Etapa 6.6 (Status de Envio) — id do pedido com a ação "Marcar como
  // enviado" em andamento: desabilita só o botão daquela linha (não a
  // tabela inteira) e evita clique duplicado disparando duas chamadas.
  const [marcandoEnviadoId, setMarcandoEnviadoId] = useState<number | null>(null);
  const [pedidoParaEnviar, setPedidoParaEnviar] = useState<Pedido | null>(null);
  const [codigoRastreio, setCodigoRastreio] = useState("");

  // Destaque "Pedidos para enviar" + filtros — inteiramente client-side
  // sobre a lista já carregada (nenhum parâmetro novo em GET /pedidos).
  const [filtros, setFiltros] = useState<PedidosFiltrosValue>(() =>
    filtrosDaUrl(new URLSearchParams(searchParams.toString())),
  );

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((pedido) => {
      if (filtros.status !== "TODOS" && pedido.status !== filtros.status) {
        return false;
      }

      if (filtros.cliente.trim() !== "") {
        const termo = filtros.cliente.trim().toLowerCase();
        const nome = pedido.clienteNome?.toLowerCase() ?? "";
        const email = pedido.clienteEmail?.toLowerCase() ?? "";
        if (!nome.includes(termo) && !email.includes(termo)) {
          return false;
        }
      }

      // Dia do pedido em America/Sao_Paulo ("YYYY-MM-DD", en-CA), comparado
      // com o valor de <input type="date">. O checkout grava o instante
      // exato da compra, então o dia é o de SP — mesmo critério do alerta
      // "pedidos pagos aguardando envio" (AlertasService), para que o link
      // ?dataAte= mostre exatamente os pedidos contados.
      const diaPedido = new Date(pedido.data).toLocaleDateString("en-CA", {
        timeZone: "America/Sao_Paulo",
      });
      if (filtros.dataDe !== "" && diaPedido < filtros.dataDe) return false;
      if (filtros.dataAte !== "" && diaPedido > filtros.dataAte) return false;

      return true;
    });
  }, [pedidos, filtros]);

  // "Aguardando envio" nunca é um status novo — é a mesma condição que já
  // habilita "Marcar como enviado" em PedidoTable.tsx (status PAGO +
  // statusEnvio NAO_ENVIADO), aplicada sobre a lista já filtrada acima: os
  // filtros (cliente/status/data) afetam igualmente este destaque e a
  // tabela completa abaixo, nunca dois conjuntos de dados dessincronizados.
  const pedidosAguardandoEnvio = useMemo(
    () =>
      pedidosFiltrados.filter(
        (pedido) =>
          pedido.status === StatusPedido.PAGO && pedido.statusEnvio === StatusEnvio.NAO_ENVIADO,
      ),
    [pedidosFiltrados],
  );

  async function carregarPedidos() {
    setLoading(true);
    setErro(null);
    try {
      const data = await listarPedidos();
      setPedidos(data);
    } catch (err) {
      const mensagem = getErrorMessage(err, "Não foi possível carregar os pedidos.");
      toast.error(mensagem);
      setErro(mensagem);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarPedidos();
  }, []);

  async function handleSubmit(data: PedidoFormValues) {
    if (!editingPedido) return;

    try {
      await atualizarPedido(editingPedido.id, data);
      setShowForm(false);
      setEditingPedido(undefined);
      toast.success("Pedido atualizado com sucesso.");
      await carregarPedidos();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar o pedido."));
    }
  }

  function handleEdit(pedido: Pedido) {
    setEditingPedido(pedido);
    setShowForm(true);
  }

  async function handleRemove(pedido: Pedido) {
    // Etapa 8.2 (HIGH-02) — texto atualizado: o botão só aparece para
    // pedidos PENDENTE (ver PedidoTable.tsx), e um pedido PENDENTE nunca
    // tem estoque consumido (só CheckoutService.confirmarPagamento()
    // decrementa estoque, e isso sempre acontece junto com a transição
    // para PAGO) — o aviso anterior sobre "estoque não devolvido" não fazia
    // mais sentido depois da correção do HIGH-02, e foi removido.
    if (
      !window.confirm(
        `Remover o pedido "${pedido.numero}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    try {
      await removerPedido(pedido.id);
      toast.success("Pedido excluído com sucesso.");
      await carregarPedidos();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível remover o pedido."));
    }
  }

  function handleCancel() {
    setShowForm(false);
    setEditingPedido(undefined);
  }

  // Etapa 6.6 (Status de Envio) — ação simples (não destrutiva, reversível
  // em espírito), mesmo padrão de confirmação já usado por handleRemove
  // nesta página (window.confirm nativo) em vez do ConfirmDialog mais
  // pesado reservado hoje só para as ações de Minha Conta (cancelar/
  // solicitar reembolso) — evita disparo acidental sem introduzir um
  // padrão de UI novo nesta tela.
  function handleAbrirMarcarEnviado(pedido: Pedido) {
    if (marcandoEnviadoId !== null) return;
    setPedidoParaEnviar(pedido);
    setCodigoRastreio(pedido.codigoRastreio ?? "");
  }

  function handleFecharMarcarEnviado() {
    if (marcandoEnviadoId !== null) return;
    setPedidoParaEnviar(null);
    setCodigoRastreio("");
  }

  async function handleConfirmarMarcarEnviado() {
    if (!pedidoParaEnviar || marcandoEnviadoId !== null) return;

    setMarcandoEnviadoId(pedidoParaEnviar.id);
    try {
      await marcarPedidoComoEnviado(pedidoParaEnviar.id, codigoRastreio);
      toast.success("Pedido marcado como enviado.");
      setPedidoParaEnviar(null);
      setCodigoRastreio("");
      await carregarPedidos();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível marcar o pedido como enviado."));
    } finally {
      setMarcandoEnviadoId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-brand-navy">Pedidos</h2>
      </div>

      {showForm && editingPedido && (
        <PedidoForm
          initialData={editingPedido}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {loading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : erro ? (
        <InlineErrorState message={erro} onRetry={carregarPedidos} />
      ) : (
        <>
          <PedidosParaEnviarCard pedidos={pedidosAguardandoEnvio} />

          <PedidosFiltros value={filtros} onChange={setFiltros} />

          <PedidoTable
            pedidos={pedidosFiltrados}
            onEdit={handleEdit}
            onRemove={handleRemove}
            onMarcarEnviado={handleAbrirMarcarEnviado}
            marcandoEnviadoId={marcandoEnviadoId}
            filtrosAtivos={temFiltroAtivo(filtros)}
          />
        </>
      )}

      <ConfirmDialog
        open={pedidoParaEnviar !== null}
        title="Marcar como enviado?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              Marcar o pedido {pedidoParaEnviar?.numero} como enviado. O código
              de rastreio aparece para o cliente em Meus Pedidos.
            </p>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700">
                Código de rastreio (opcional)
              </span>
              <input
                type="text"
                value={codigoRastreio}
                onChange={(event) => setCodigoRastreio(event.target.value)}
                maxLength={80}
                disabled={marcandoEnviadoId !== null}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm transition-colors duration-200 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
              />
            </label>
          </div>
        }
        confirmLabel="Confirmar envio"
        confirmingLabel="Marcando..."
        confirmVariant="primary"
        confirming={marcandoEnviadoId !== null}
        onConfirm={handleConfirmarMarcarEnviado}
        onCancel={handleFecharMarcarEnviado}
      />
    </div>
  );
}
