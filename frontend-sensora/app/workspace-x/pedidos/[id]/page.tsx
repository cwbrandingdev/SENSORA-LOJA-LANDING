"use client";

// Etapa 8.1 (complemento — eliminação da venda manual) — esta página não
// permite mais adicionar itens a um pedido. "Adicionar item" foi removido
// de propósito: a Sensora não tem venda manual, então não existe mais forma
// de montar uma venda item a item pela área administrativa (os itens de um
// pedido nascem exclusivamente do Checkout). O que resta aqui é só
// gerenciamento de itens já existentes (corrigir quantidade/produto,
// remover) — nunca criar um item novo do zero.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { isAxiosError } from "axios";
import ItemPedidoTable from "@/components/tables/ItemPedidoTable";
import ItemPedidoForm, { type ItemPedidoFormValues } from "@/components/forms/ItemPedidoForm";
import EmptyState from "@/components/ui/EmptyState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import FormButton from "@/components/ui/FormButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  buscarPedidoComItens,
  atualizarPedido,
  solicitarReembolsoMeuPedido,
} from "@/services/pedidos";
import { atualizarItemPedido, removerItemPedido } from "@/services/itensPedido";
import { listarProdutos } from "@/services/produtos";
import { ROUTES } from "@/lib/routes";
import {
  PerfilUsuario,
  StatusEnvio,
  StatusPedido,
  type Pedido,
  type ItemPedido,
  type Produto,
} from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Fase A (Admin/Pedidos) — mesmo critério já usado em
// app/(site)/conta/pedidos/[id]/page.tsx#possuiEnderecoCompleto: só
// considera o snapshot de endereço "completo" quando os campos essenciais
// vieram preenchidos, nunca renderiza um endereço pela metade. Pedidos
// anteriores à Etapa 6.5 (Frete) não têm nenhum desses campos.
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

// Mesmos tons de PedidoTable.tsx (Admin) — só o nome do status muda, a
// receita visual é a mesma em toda a aba Pedidos.
const STATUS_LABEL: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "Pendente",
  [StatusPedido.PAGO]: "Pago",
  [StatusPedido.CANCELADO]: "Cancelado",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "Reembolso solicitado",
  [StatusPedido.REEMBOLSADO]: "Reembolsado",
};

const STATUS_TONE: Record<StatusPedido, BadgeTone> = {
  [StatusPedido.PENDENTE]: "warning",
  [StatusPedido.PAGO]: "success",
  [StatusPedido.CANCELADO]: "danger",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "info",
  [StatusPedido.REEMBOLSADO]: "neutral",
};

export default function PedidoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const pedidoId = Number(id);
  const toast = useToast();
  const { perfil } = useAuth();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pedidoNaoEncontrado, setPedidoNaoEncontrado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ItemPedido | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  // Fase A (Reembolso no Admin) — desabilita só o botão durante a chamada,
  // evita clique duplicado disparando duas solicitações (mesmo padrão de
  // `marcandoEnviadoId` em app/workspace-x/pedidos/page.tsx).
  const [solicitandoReembolso, setSolicitandoReembolso] = useState(false);

  async function carregarPedido() {
    setLoading(true);
    setPedidoNaoEncontrado(false);
    setErro(null);

    // ID fora da URL não é um número válido — mesmo resultado prático de um
    // pedido inexistente, sem depender de como o backend reagiria a um path
    // param malformado (Task 19).
    if (Number.isNaN(pedidoId)) {
      setPedidoNaoEncontrado(true);
      setLoading(false);
      return;
    }

    try {
      const [pedidoComItens, listaProdutos] = await Promise.all([
        buscarPedidoComItens(pedidoId),
        listarProdutos(),
      ]);

      setProdutos(listaProdutos);
      setItens(pedidoComItens.itens);
      setPedido(pedidoComItens.pedido);

      if (pedidoComItens.total !== pedidoComItens.pedido.total) {
        await atualizarPedido(pedidoId, { total: pedidoComItens.total });
        setPedido((prev) => (prev ? { ...prev, total: pedidoComItens.total } : prev));
      }
    } catch (err) {
      // 404 é um resultado esperado (pedido inexistente/removido), não uma
      // falha a reportar por toast — os demais erros (500, timeout, rede)
      // mantêm o tratamento existente. 401 nunca cai aqui como 404: o
      // interceptor de services/api.ts já trata sessão expirada à parte.
      if (isAxiosError(err) && err.response?.status === 404) {
        setPedidoNaoEncontrado(true);
      } else {
        const mensagem = getErrorMessage(err, "Não foi possível carregar o pedido.");
        toast.error(mensagem);
        setErro(mensagem);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarPedido();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  async function handleSubmit(data: ItemPedidoFormValues) {
    if (!editingItem) return;

    try {
      await atualizarItemPedido(editingItem.id, data);
      setShowForm(false);
      setEditingItem(undefined);
      toast.success("Item do pedido atualizado com sucesso.");
      await carregarPedido();
    } catch (err) {
      // getErrorMessage preserva mensagens específicas do backend (estoque
      // insuficiente, produto/pedido inexistente etc.) em vez de escondê-las.
      toast.error(getErrorMessage(err, "Não foi possível salvar o item."));
    }
  }

  function handleEdit(item: ItemPedido) {
    setEditingItem(item);
    setShowForm(true);
  }

  async function handleRemove(item: ItemPedido) {
    if (
      !window.confirm(
        "Remover este item do pedido? O estoque do produto será devolvido.",
      )
    ) {
      return;
    }

    try {
      await removerItemPedido(item.id);
      toast.success("Item removido do pedido com sucesso.");
      await carregarPedido();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível remover o item."));
    }
  }

  function handleCancel() {
    setShowForm(false);
    setEditingItem(undefined);
  }

  // Fase A (Reembolso no Admin) — reutiliza exatamente o mesmo serviço/
  // endpoint já usado por app/(site)/conta/pedidos/[id]/page.tsx
  // (POST /pedidos/meus/:id/cancelar-pago): nenhuma lógica de negócio nova,
  // nenhum endpoint novo. Validação de estado (só PAGO), idempotência e
  // claim atômico continuam inteiramente resolvidos em
  // PedidosService.solicitarReembolso — esta função só confirma com o
  // admin, chama o serviço existente e recarrega o pedido.
  async function handleSolicitarReembolso() {
    if (!pedido || solicitandoReembolso) return;

    if (
      !window.confirm(
        `Solicitar reembolso do pedido "${pedido.numero}"? Esta ação inicia o processo de estorno junto ao Asaas.`,
      )
    ) {
      return;
    }

    setSolicitandoReembolso(true);
    try {
      await solicitarReembolsoMeuPedido(pedido.id);
      toast.success("Reembolso solicitado com sucesso.");
      await carregarPedido();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível solicitar o reembolso."));
    } finally {
      setSolicitandoReembolso(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link
          href={ROUTES.PEDIDOS}
          className="text-sm font-medium text-brand-navy hover:underline"
        >
          ← Voltar para pedidos
        </Link>
      </p>

      {pedidoNaoEncontrado ? (
        <EmptyState
          eyebrow="Erro"
          title="Pedido não encontrado"
          message="O pedido solicitado não existe ou não foi localizado."
        />
      ) : erro ? (
        <InlineErrorState message={erro} onRetry={carregarPedido} />
      ) : loading || !pedido ? (
        <TableSkeleton rows={3} columns={4} />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-brand-navy">
                Pedido {pedido.numero}
              </h2>
              <p className="text-sm text-slate-500">
                {new Date(pedido.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Badge tone={STATUS_TONE[pedido.status]}>{STATUS_LABEL[pedido.status]}</Badge>
              <span>Total: {formatPrice.format(pedido.total)}</span>
            </div>
          </div>

          {/* Fase A (Reembolso no Admin) — exclusivo de ADMIN no painel (o
              Sensora não opera com perfil VENDEDOR); só visível quando o
              status financeiro é PAGO, mesma condição já usada pelo cliente
              em app/(site)/conta/pedidos/[id]/page.tsx. Nenhuma checagem de
              permissão nova no backend: RolesGuard/podeAcessar continuam
              sendo a autoridade real, isto é só a UI que decide oferecer o
              botão. */}
          {perfil === PerfilUsuario.ADMIN && pedido.status === StatusPedido.PAGO && (
            <div>
              <FormButton
                variant="danger"
                disabled={solicitandoReembolso}
                onClick={handleSolicitarReembolso}
              >
                {solicitandoReembolso ? "Solicitando..." : "Solicitar reembolso"}
              </FormButton>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cliente
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {pedido.clienteNome ?? "Não informado"}
              </p>
              <p className="text-sm text-slate-500">{pedido.clienteEmail ?? "—"}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Envio
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={pedido.statusEnvio === StatusEnvio.ENVIADO ? "info" : "warning"}>
                  {pedido.statusEnvio === StatusEnvio.ENVIADO ? "Enviado" : "Aguardando envio"}
                </Badge>
                {pedido.statusEnvio === StatusEnvio.ENVIADO && pedido.enviadoEm && (
                  <span className="text-xs text-slate-500">
                    {new Date(pedido.enviadoEm).toLocaleDateString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Endereço de entrega
              </p>
              {possuiEnderecoCompleto(pedido) ? (
                <address className="mt-1 text-sm leading-relaxed text-slate-700 not-italic">
                  <p>
                    {pedido.enderecoRua}, {pedido.enderecoNumero}
                  </p>
                  {pedido.enderecoComplemento && <p>{pedido.enderecoComplemento}</p>}
                  <p>{pedido.enderecoBairro}</p>
                  <p>
                    {pedido.enderecoCidade} / {pedido.enderecoEstado}
                  </p>
                  <p>CEP {pedido.enderecoCep}</p>
                </address>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  Endereço não disponível para este pedido.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Frete
              </p>
              {pedido.freteTransportadora || pedido.freteServico || pedido.freteValor != null ? (
                <div className="mt-1 text-sm leading-relaxed text-slate-700">
                  <p>
                    {[pedido.freteTransportadora, pedido.freteServico]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                  {pedido.freteValor != null && <p>{formatPrice.format(pedido.freteValor)}</p>}
                  {pedido.fretePrazoDias != null && (
                    <p>Prazo: {pedido.fretePrazoDias} dia(s)</p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  Frete não disponível para este pedido.
                </p>
              )}
            </div>
          </div>

          {showForm && editingItem && (
            <ItemPedidoForm
              produtos={produtos}
              initialData={editingItem}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          )}

          <ItemPedidoTable
            itens={itens}
            produtos={produtos}
            onEdit={handleEdit}
            onRemove={handleRemove}
          />
        </>
      )}
    </div>
  );
}
