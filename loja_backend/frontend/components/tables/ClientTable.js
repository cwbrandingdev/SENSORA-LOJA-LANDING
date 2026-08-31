import { Pencil, Trash2, Users } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import IconActionButton from "@/components/ui/IconActionButton";
import Button from "@/components/ui/Button";

export function ClientTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-6 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-6 border-b border-slate-100 px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

function Empty({ value }) {
  return value || <span className="text-slate-400">—</span>;
}

export default function ClientTable({ clientes, onEdit, onRemove, onCreate }) {
  if (!clientes || clientes.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum cliente cadastrado"
        description="Assim que você criar o primeiro cliente, ele aparecerá aqui."
        action={
          onCreate && (
            <Button variant="primary" onClick={onCreate}>
              Novo cliente
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
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Contato</th>
              <th className="px-4 py-3 font-medium">CPF</th>
              <th className="px-4 py-3 font-medium">Endereço</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr
                key={cliente.id}
                className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50"
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <p className="font-medium text-slate-900">
                    <Empty value={cliente.nome} />
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <p className="text-slate-700">
                    <Empty value={cliente.email} />
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    <Empty value={cliente.telefone} />
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  <Empty value={cliente.cpf} />
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-600">
                  <Empty value={cliente.endereco} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <IconActionButton
                      icon={Pencil}
                      label={`Editar ${cliente.nome}`}
                      onClick={() => onEdit(cliente)}
                    />
                    <IconActionButton
                      icon={Trash2}
                      label={`Remover ${cliente.nome}`}
                      variant="danger"
                      onClick={() => onRemove(cliente)}
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
