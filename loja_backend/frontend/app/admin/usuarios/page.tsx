"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import UserTable, { UserTableSkeleton } from "@/components/tables/UserTable";
import UserForm from "@/components/forms/UserForm";
import Dialog from "@/components/ui/Dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FormButton from "@/components/ui/FormButton";
import { useAuth } from "@/context/AuthContext";
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  removerUsuario,
} from "@/services/usuarios";
import type { Usuario } from "@/lib/types";

export default function UsuariosPage() {
  const { perfil, userId } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregarUsuarios() {
    setLoading(true);
    setLoadError("");
    try {
      const data: Usuario[] = await listarUsuarios();
      setUsuarios(data);
    } catch {
      setLoadError("Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (perfil === "ADMIN") {
      carregarUsuarios();
    } else {
      setLoading(false);
    }
  }, [perfil]);

  async function handleSubmit(data: Partial<Usuario> & { senha?: string }) {
    const payload = { ...data };
    if (editingUser && !payload.senha) {
      delete payload.senha;
    }

    try {
      if (editingUser) {
        await atualizarUsuario(editingUser.id, payload);
        toast.success("Usuário atualizado com sucesso.");
      } else {
        await criarUsuario(payload);
        toast.success("Usuário criado com sucesso.");
      }
      setDialogOpen(false);
      setEditingUser(null);
      await carregarUsuarios();
    } catch (error: any) {
      if (error?.response?.status === 401) {
        toast.error("Sessão expirada. Faça login novamente.");
      } else {
        toast.error(
          editingUser
            ? "Não foi possível atualizar o usuário."
            : "Não foi possível criar o usuário.",
        );
      }
    }
  }

  function handleEdit(usuario: Usuario) {
    setEditingUser(usuario);
    setDialogOpen(true);
  }

  function handleNovoUsuario() {
    setEditingUser(null);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditingUser(null);
    }
  }

  const isSelfDelete =
    usuarioToDelete !== null &&
    userId !== null &&
    usuarioToDelete.id === userId;

  async function handleConfirmRemove() {
    if (!usuarioToDelete) return;

    setDeleting(true);
    try {
      await removerUsuario(usuarioToDelete.id);
      toast.success("Usuário excluído com sucesso.");
      setUsuarioToDelete(null);
      await carregarUsuarios();
    } catch {
      // Mantém o diálogo aberto em caso de erro, para o usuário tentar
      // novamente ou cancelar — só fecha automaticamente no sucesso.
      toast.error("Não foi possível excluir o usuário.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {perfil !== "ADMIN" ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Acesso restrito a administradores. Esta é apenas uma restrição
          visual do frontend — o backend não impõe controle de perfil nesta
          rota.
        </p>
      ) : (
        <div className="motion-safe:animate-[fade-in-up_250ms_ease-out] flex flex-col gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-brand-navy">
                Usuários
              </h2>
              <p className="text-sm text-slate-500">
                Gerencie contas de acesso, perfis e status dos usuários.
              </p>
            </div>
            <FormButton
              variant="primary"
              onClick={handleNovoUsuario}
              className="w-fit active:scale-[0.98]"
            >
              + Novo usuário
            </FormButton>
          </div>

          {loadError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {loadError}
            </p>
          )}

          {loading ? (
            <UserTableSkeleton />
          ) : (
            <UserTable
              usuarios={usuarios}
              onEdit={handleEdit}
              onRemove={setUsuarioToDelete}
              onCreate={handleNovoUsuario}
            />
          )}

          <Dialog
            open={dialogOpen}
            onOpenChange={handleDialogOpenChange}
            title={editingUser ? "Editar usuário" : "Novo usuário"}
            description={
              editingUser
                ? "Atualize as informações do usuário."
                : "Preencha os dados para cadastrar um novo usuário."
            }
          >
            <UserForm
              initialData={editingUser}
              onSubmit={handleSubmit}
              onCancel={() => handleDialogOpenChange(false)}
            />
          </Dialog>

          <ConfirmDialog
            open={Boolean(usuarioToDelete)}
            onOpenChange={(open: boolean) => {
              if (!open) setUsuarioToDelete(null);
            }}
            title={
              isSelfDelete ? "Excluir sua própria conta?" : "Excluir usuário?"
            }
            description={
              usuarioToDelete
                ? isSelfDelete
                  ? `Atenção: você está prestes a excluir a SUA PRÓPRIA conta (${usuarioToDelete.email}). Isso pode encerrar seu acesso imediatamente. Deseja continuar?`
                  : `Tem certeza que deseja excluir o usuário "${usuarioToDelete.nome}"? Esta ação não pode ser desfeita.`
                : undefined
            }
            confirmLabel="Excluir"
            onConfirm={handleConfirmRemove}
            loading={deleting}
          />
        </div>
      )}
    </>
  );
}
