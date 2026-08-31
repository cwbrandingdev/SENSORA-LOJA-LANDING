// Portado de frontend/components/tables/ClientTable.js — mesmo
// comportamento e colunas.
import FormButton from "@/components/ui/FormButton";
import EmptyState from "@/components/ui/EmptyState";
import type { Cliente } from "@/lib/types/loja";

type ClientTableProps = {
  clientes: Cliente[];
  onEdit: (cliente: Cliente) => void;
  onRemove: (cliente: Cliente) => void;
};

export default function ClientTable({ clientes, onEdit, onRemove }: ClientTableProps) {
  if (!clientes || clientes.length === 0) {
    return (
      <EmptyState
        compact
        eyebrow="Clientes"
        title="Nenhum cliente cadastrado"
        message="Cadastre o primeiro cliente para começar."
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
            <th className="px-4 py-2 font-medium">Telefone</th>
            <th className="px-4 py-2 font-medium">CPF</th>
            <th className="px-4 py-2 font-medium">Endereço</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => (
            <tr key={cliente.id} className="border-t border-slate-200 hover:bg-slate-50">
              <td className="px-4 py-2">{cliente.nome}</td>
              <td className="px-4 py-2">{cliente.email}</td>
              <td className="px-4 py-2">{cliente.telefone}</td>
              <td className="px-4 py-2">{cliente.cpf}</td>
              <td className="px-4 py-2">{cliente.endereco}</td>
              <td className="px-4 py-2">
                <div className="flex gap-2">
                  <FormButton variant="secondary" onClick={() => onEdit(cliente)}>
                    Editar
                  </FormButton>
                  <FormButton variant="danger" onClick={() => onRemove(cliente)}>
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
