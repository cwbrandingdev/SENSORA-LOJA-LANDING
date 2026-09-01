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
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import EmptyState from "@/components/ui/EmptyState";
import FormButton from "@/components/ui/FormButton";
import EnderecoForm, { type EnderecoFormValues } from "@/components/loja/EnderecoForm";
import EnderecoManageCard from "@/components/conta/EnderecoManageCard";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
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

  async function handleExcluir(endereco: Endereco) {
    if (
      !window.confirm(
        `Remover o endereço "${endereco.rua}, ${endereco.numero}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    setProcessandoId(endereco.id);
    try {
      await removerEndereco(endereco.id);
      toast.success("Endereço removido com sucesso.");
      await carregarEnderecos();
    } catch (err) {
      // 404 aqui só pode significar que o endereço já foi removido em outra
      // aba/sessão — a lista sendo recarregada abaixo já reflete isso.
      if (isAxiosError(err) && err.response?.status === 404) {
        await carregarEnderecos();
      } else {
        toast.error(getErrorMessage(err, "Não foi possível remover o endereço."));
      }
    } finally {
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

  return (
    <div className="mx-auto max-w-4xl px-6 pt-28 pb-24 sm:pt-36 sm:pb-32 lg:px-10">
      <RevealOnScroll>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Minha Conta
        </p>
        <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
          Endereços
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
          Gerencie os endereços utilizados em seus pedidos.
        </p>
      </RevealOnScroll>

      <RevealOnScroll delayMs={90}>
        <div className="mt-10 flex flex-col gap-6">
          {!mostrarFormulario && (
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
            <p className="text-sm text-slate-500">Carregando endereços...</p>
          ) : enderecos.length === 0 && !mostrarFormulario ? (
            <EmptyState
              eyebrow="Endereços"
              title="Você ainda não possui endereços cadastrados"
              message="Cadastre um endereço para agilizar suas próximas compras."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {enderecos.map((endereco) => (
                <EnderecoManageCard
                  key={endereco.id}
                  endereco={endereco}
                  onEditar={() => handleEditar(endereco)}
                  onExcluir={() => handleExcluir(endereco)}
                  onTornarPadrao={() => handleTornarPadrao(endereco)}
                  processando={processandoId === endereco.id}
                />
              ))}
            </div>
          )}
        </div>
      </RevealOnScroll>
    </div>
  );
}
