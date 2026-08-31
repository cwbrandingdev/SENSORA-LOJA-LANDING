// Portado de frontend/components/tables/UserTable.js — mesmo comportamento
// e colunas.
import FormButton from "@/components/ui/FormButton";
import EmptyState from "@/components/ui/EmptyState";
import type { Usuario } from "@/lib/types/loja";

type UserTableProps = {
  usuarios: Usuario[];
  onEdit: (usuario: Usuario) => void;
  onRemove: (usuario: Usuario) => void;
};

export default function UserTable({ usuarios, onEdit, onRemove }: UserTableProps) {
  if (!usuarios || usuarios.length === 0) {
    return (
      <EmptyState
        compact
        eyebrow="Usuários"
        title="Nenhum usuário cadastrado"
        message="Cadastre o primeiro usuário administrativo."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-brand-navy text-white">
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Perfil</th>
            <th className="px-4 py-2 font-medium">Ativo</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id} className="border-t border-slate-200 hover:bg-slate-50">
              <td className="px-4 py-2">{usuario.nome}</td>
              <td className="px-4 py-2">{usuario.email}</td>
              <td className="px-4 py-2">{usuario.perfil}</td>
              <td className="px-4 py-2">{usuario.ativo ? "Sim" : "Não"}</td>
              <td className="px-4 py-2">
                <div className="flex gap-2">
                  <FormButton variant="secondary" onClick={() => onEdit(usuario)}>
                    Editar
                  </FormButton>
                  <FormButton variant="danger" onClick={() => onRemove(usuario)}>
                    Remover
                  </FormButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
