// Portado de frontend/components/tables/UserTable.js — mesmo comportamento
// e colunas.
//
// Refinamento visual (Admin) — cabeçalho claro e Badge no status
// ativo/inativo, mesmo padrão de PedidoTable.tsx/ProductTable.tsx. Nenhum
// status novo, nenhuma coluna/ação removida.
//
// Rodada 2 (padrão ERP/SaaS, referência 21st.dev) — avatar de iniciais para
// dar âncora visual à coluna "Nome" (mesma ideia do ícone de categoria em
// CategoryTable.tsx), badge de tom por perfil (ADMIN/VENDEDOR/CLIENTE) e
// rótulo "Ativo"/"Inativo" no lugar de "Sim"/"Não" — só para bater com o
// mesmo vocabulário de status já usado em ProductTable.tsx (mesmo dado
// `usuario.ativo`, nenhuma regra alterada). Ações viraram ícones com
// tooltip (RowActions.tsx), mesmo texto acessível ("Editar"/"Remover") de
// antes — os testes E2E de admin-usuarios.spec.ts continuam localizando o
// botão por `getByRole("button", { name: "Editar" })`.
import { Pencil, Trash2, UserCog } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import RowActions from "@/components/ui/RowActions";
import { PerfilUsuario, type Usuario } from "@/lib/types/loja";

type UserTableProps = {
  usuarios: Usuario[];
  onEdit: (usuario: Usuario) => void;
  onRemove: (usuario: Usuario) => void;
};

const PERFIL_LABEL: Record<PerfilUsuario, string> = {
  [PerfilUsuario.ADMIN]: "Admin",
  [PerfilUsuario.VENDEDOR]: "Vendedor",
  [PerfilUsuario.CLIENTE]: "Cliente",
};

const PERFIL_TONE: Record<PerfilUsuario, BadgeTone> = {
  [PerfilUsuario.ADMIN]: "info",
  [PerfilUsuario.VENDEDOR]: "warning",
  [PerfilUsuario.CLIENTE]: "neutral",
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

export default function UserTable({ usuarios, onEdit, onRemove }: UserTableProps) {
  if (!usuarios || usuarios.length === 0) {
    return (
      <EmptyState
        compact
        eyebrow="Usuários"
        title="Nenhum usuário cadastrado"
        message="Cadastre o primeiro usuário administrativo."
        icon={UserCog}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] table-fixed text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th className="w-[220px] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Nome
            </th>
            <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Email
            </th>
            <th className="w-[130px] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Perfil
            </th>
            <th className="w-[110px] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Status
            </th>
            <th className="w-[96px] px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {usuarios.map((usuario) => (
            <tr key={usuario.id} className="transition-colors hover:bg-slate-50/70">
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-navy/10 text-xs font-semibold text-brand-navy"
                  >
                    {iniciais(usuario.nome)}
                  </span>
                  <p className="truncate font-medium text-slate-900">{usuario.nome}</p>
                </div>
              </td>
              <td className="px-5 py-4">
                <p className="truncate text-slate-500" title={usuario.email}>
                  {usuario.email}
                </p>
              </td>
              <td className="px-5 py-4">
                <Badge tone={PERFIL_TONE[usuario.perfil]}>{PERFIL_LABEL[usuario.perfil]}</Badge>
              </td>
              <td className="px-5 py-4">
                <Badge tone={usuario.ativo ? "success" : "neutral"}>
                  {usuario.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </td>
              <td className="px-5 py-4">
                <RowActions
                  actions={[
                    { label: "Editar", icon: Pencil, onClick: () => onEdit(usuario) },
                    {
                      label: "Remover",
                      icon: Trash2,
                      variant: "danger",
                      onClick: () => onRemove(usuario),
                    },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
