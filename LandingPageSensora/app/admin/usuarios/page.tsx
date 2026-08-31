"use client";

import { useEffect, useState } from "react";
import UserTable from "@/components/tables/UserTable";
import UserForm from "@/components/forms/UserForm";
import FormButton from "@/components/ui/FormButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  removerUsuario,
} from "@/services/usuarios";
import { PerfilUsuario, type Usuario } from "@/lib/types/loja";

type UsuarioFormSubmit = {
  nome: string;
  email: string;
  senha: string;
  perfil: PerfilUsuario;
  ativo: boolean;
};

export default function UsuariosPage() {
  const { perfil, userId } = useAuth();
  const toast = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Usuario | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);

  async function carregarUsuarios() {
    setLoading(true);
    try {
      const data = await listarUsuarios();
      setUsuarios(data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível carregar os usuários."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (perfil === PerfilUsuario.ADMIN) {
      carregarUsuarios();
    } else {
      setLoading(false);
    }
  }, [perfil]);

  async function handleSubmit(data: UsuarioFormSubmit) {
    const editando = Boolean(editingUser);
    try {
      if (editingUser) {
        const payload: Partial<UsuarioFormSubmit> = { ...data };
        if (!payload.senha) {
          delete payload.senha;
        }
        await atualizarUsuario(editingUser.id, payload);
      } else {
        await criarUsuario(data);
      }
      setShowForm(false);
      setEditingUser(undefined);
      toast.success(editando ? "Usuário atualizado com sucesso." : "Usuário criado com sucesso.");
      await carregarUsuarios();
    } catch (err) {
      // 401 aqui já é tratado globalmente pelo interceptor de resposta em
      // services/api.ts (limpa o token e redireciona pro /login) — não
      // precisa de tratamento especial duplicado nesta página.
      toast.error(getErrorMessage(err, "Não foi possível salvar o usuário."));
    }
  }

  function handleEdit(usuario: Usuario) {
    setEditingUser(usuario);
    setShowForm(true);
  }

  async function handleRemove(usuario: Usuario) {
    const isSelf = userId !== null && usuario.id === userId;
    const confirmMessage = isSelf
      ? `Atenção: você está prestes a excluir a SUA PRÓPRIA conta (${usuario.email}). Isso pode encerrar seu acesso imediatamente. Deseja continuar?`
      : `Remover o usuário "${usuario.nome}"?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await removerUsuario(usuario.id);
      toast.success("Usuário excluído com sucesso.");
      await carregarUsuarios();
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível remover o usuário."));
    }
  }

  function handleNovoUsuario() {
    setEditingUser(undefined);
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingUser(undefined);
  }

  if (perfil !== PerfilUsuario.ADMIN) {
    return (
      <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        Acesso restrito a administradores.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-brand-navy">Usuários</h2>
        <FormButton variant="primary" onClick={handleNovoUsuario}>
          Novo usuário
        </FormButton>
      </div>

      {showForm && (
        <UserForm
          initialData={editingUser}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando usuários...</p>
      ) : (
        <UserTable usuarios={usuarios} onEdit={handleEdit} onRemove={handleRemove} />
      )}
    </div>
  );
}
