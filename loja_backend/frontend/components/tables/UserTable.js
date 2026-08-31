import { Pencil, Trash2, Users } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import IconActionButton from "@/components/ui/IconActionButton";
import Button from "@/components/ui/Button";

const PERFIL_LABEL = {
  ADMIN: "Admin",
  VENDEDOR: "Vendedor",
  CLIENTE: "Cliente",
};

const PERFIL_VARIANT = {
  ADMIN: "info",
  VENDEDOR: "warning",
  CLIENTE: "neutral",
};

function PerfilBadge({ perfil }) {
  return (
    <Badge variant={PERFIL_VARIANT[perfil] ?? "neutral"}>
      {PERFIL_LABEL[perfil] ?? perfil}
    </Badge>
  );
}

function AtivoBadge({ ativo }) {
  return (
    <Badge variant={ativo ? "success" : "neutral"}>
      {ativo ? "Ativo" : "Inativo"}
    </Badge>
  );
}

export function UserTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="ml-auto h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function UserTable({ usuarios, onEdit, onRemove, onCreate }) {
  if (!usuarios || usuarios.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum usuário cadastrado"
        description="Assim que você criar o primeiro usuário, ele aparecerá aqui."
        action={
          onCreate && (
            <Button variant="primary" onClick={onCreate}>
              Novo usuário
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Perfil</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr
                key={usuario.id}
                className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <p className="font-medium text-slate-900">{usuario.nome}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{usuario.email}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <PerfilBadge perfil={usuario.perfil} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <AtivoBadge ativo={usuario.ativo} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <IconActionButton
                      icon={Pencil}
                      label={`Editar ${usuario.nome}`}
                      onClick={() => onEdit(usuario)}
                    />
                    <IconActionButton
                      icon={Trash2}
                      label={`Remover ${usuario.nome}`}
                      variant="danger"
                      onClick={() => onRemove(usuario)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
