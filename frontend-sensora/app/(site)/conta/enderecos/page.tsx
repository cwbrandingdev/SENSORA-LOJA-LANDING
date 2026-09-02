"use client";

// Etapa 4 (Minha Conta / Endereços) — CRUD completo sobre /enderecos
// (endpoint já existente desde a Task 8, agora com atualizarEndereco/
// removerEndereco consumidos pela primeira vez, ver services/enderecos.ts).
// Ownership é resolvido inteiramente no backend via @CurrentUser() — nenhum
// id de usuário é enviado por esta página, e cada operação (GET/POST/PUT/
// DELETE) já era escopada por usuarioId no service (EnderecosService,
// auditado na Etapa 4, sem alteração de comportamento aqui).
import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { MapPinPlus } from "lucide-react";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import EmptyState from "@/components/ui/EmptyState";
import FormButton from "@/components/ui/FormButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import AccountPageHeader from "@/components/conta/AccountPageHeader";
import EnderecoForm, { type EnderecoFormValues } from "@/components/loja/EnderecoForm";
import EnderecoManageCard from "@/components/conta/EnderecoManageCard";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { ROUTES } from "@/lib/routes";
import {
  atualizarEndereco,
  criarEndereco,
  listarEnderecos,
  removerEndereco,
} from "@/services/enderecos";
import type { Endereco } from "@/lib/types/loja";

export default function EnderecosPage() {
  const toast = useToast();
  const [enderecos, setEnderecos] = useState<Endereco[] | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState<Endereco | undefined>(undefined);
  const [processandoId, setProcessandoId] = useState<number | null>(null);
  const [enderecoParaExcluir, setEnderecoParaExcluir] = useState<Endereco | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregarEnderecos = useCallback(async () => {
    try {
      const data = await listarEnderecos();
      setEnderecos(data);
    } catch (err) {
      setEnderecos([]);
      toast.error(getErrorMessage(err, "Não foi possível carregar seus endereços."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregarEnderecos();
  }, [carregarEnderecos]);

  function handleNovoEndereco() {
    setEditando(undefined);
    setMostrarFormulario(true);
  }

  function handleEditar(endereco: Endereco) {
    setEditando(endereco);
    setMostrarFormulario(true);
  }

  function handleCancelarFormulario() {
    setMostrarFormulario(false);
    setEditando(undefined);
  }

  async function handleSubmit(data: EnderecoFormValues) {
    try {
      if (editando) {
        await atualizarEndereco(editando.id, data);
        toast.success("Endereço atualizado com sucesso.");
      } else {
        await criarEndereco(data);
        toast.success("Endereço cadastrado com sucesso.");
      }
      setMostrarFormulario(false);
      setEditando(undefined);
      await carregarEnderecos();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar o endereço."));
    }
  }

  // Etapa 6.1 (Refinamento) — mesma troca de UI de confirmação do
  // cancelamento/reembolso de pedido: `window.confirm` nativo vira
  // ConfirmDialog. Lógica de exclusão (inclusive o tratamento de 404 como
  // "já removido em outra sessão") continua idêntica.
  function handleAbrirModalExcluir(endereco: Endereco) {
    setEnderecoParaExcluir(endereco);
  }

  function handleFecharModalExcluir() {
    if (excluindo) return;
    setEnderecoParaExcluir(null);
  }

  async function handleConfirmarExclusao() {
    if (!enderecoParaExcluir || excluindo) return;
    const endereco = enderecoParaExcluir;

    setExcluindo(true);
    setProcessandoId(endereco.id);
    try {
      await removerEndereco(endereco.id);
      toast.success("Endereço removido com sucesso.");
      setEnderecoParaExcluir(null);
      await carregarEnderecos();
    } catch (err) {
      // 404 aqui só pode significar que o endereço já foi removido em outra
      // aba/sessão — a lista sendo recarregada abaixo já reflete isso.
      if (isAxiosError(err) && err.response?.status === 404) {
        setEnderecoParaExcluir(null);
        await carregarEnderecos();
      } else {
        toast.error(getErrorMessage(err, "Não foi possível remover o endereço."));
      }
    } finally {
      setExcluindo(false);
      setProcessandoId(null);
    }
  }

  async function handleTornarPadrao(endereco: Endereco) {
    setProcessandoId(endereco.id);
    try {
      await atualizarEndereco(endereco.id, { padrao: true });
      toast.success("Endereço definido como padrão.");
      await carregarEnderecos();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível definir o endereço como padrão."));
    } finally {
      setProcessandoId(null);
    }
  }

  const listaVazia = enderecos !== null && enderecos.length === 0;

  return (
    <div className="mx-auto max-w-4xl px-6 pt-28 pb-24 sm:pt-36 sm:pb-32 lg:px-10">
      <AccountPageHeader
        backHref={ROUTES.CONTA}
        backLabel="Voltar para Minha Conta"
        title="Endereços"
        description="Gerencie os endereços utilizados em seus pedidos."
      />

      <RevealOnScroll delayMs={90}>
        <div className="mt-10 flex flex-col gap-6">
          {/* Etapa 6.1 — com a lista vazia, o CTA de cadastro passa a viver
              só dentro do EmptyState (abaixo), evitando duas ações
              "adicionar" repetidas na tela. */}
          {!mostrarFormulario && !listaVazia && (
            <div>
              <FormButton type="button" variant="primary" onClick={handleNovoEndereco}>
                + Adicionar endereço
              </FormButton>
            </div>
          )}

          {mostrarFormulario && (
            <EnderecoForm
              initialData={editando}
              onSubmit={handleSubmit}
              onCancel={handleCancelarFormulario}
            />
          )}

          {enderecos === null ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              <Skeleton className="h-[104px] rounded-sm" />
              <Skeleton className="h-[104px] rounded-sm" />
            </div>
          ) : listaVazia && !mostrarFormulario ? (
            <EmptyState
              eyebrow="Endereços"
              icon={MapPinPlus}
              title="Você ainda não possui endereços cadastrados"
              message="Cadastre um endereço para agilizar suas próximas compras."
              action={
                <FormButton type="button" variant="primary" onClick={handleNovoEndereco}>
                  + Adicionar endereço
                </FormButton>
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              {enderecos.map((endereco) => (
                <EnderecoManageCard
                  key={endereco.id}
                  endereco={endereco}
                  onEditar={() => handleEditar(endereco)}
                  onExcluir={() => handleAbrirModalExcluir(endereco)}
                  onTornarPadrao={() => handleTornarPadrao(endereco)}
                  processando={processandoId === endereco.id}
                />
              ))}
            </div>
          )}
        </div>
      </RevealOnScroll>

      <ConfirmDialog
        open={enderecoParaExcluir !== null}
        title="Remover endereço?"
        description={
          enderecoParaExcluir ? (
            <p>
              Remover o endereço &ldquo;{enderecoParaExcluir.rua},{" "}
              {enderecoParaExcluir.numero}&rdquo;? Esta ação não pode ser
              desfeita.
            </p>
          ) : null
        }
        confirmLabel="Remover endereço"
        confirmingLabel="Removendo..."
        confirming={excluindo}
        onConfirm={handleConfirmarExclusao}
        onCancel={handleFecharModalExcluir}
      />
    </div>
  );
}
