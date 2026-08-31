// Portado de frontend/components/tables/CategoryTable.js — mesmo
// comportamento e colunas.
import FormButton from "@/components/ui/FormButton";
import EmptyState from "@/components/ui/EmptyState";
import type { Categoria } from "@/lib/types/loja";

type CategoryTableProps = {
  categorias: Categoria[];
  onEdit: (categoria: Categoria) => void;
  onRemove: (categoria: Categoria) => void;
};

export default function CategoryTable({ categorias, onEdit, onRemove }: CategoryTableProps) {
  if (!categorias || categorias.length === 0) {
    return (
      <EmptyState
        compact
        eyebrow="Categorias"
        title="Nenhuma categoria cadastrada"
        message="Cadastre a primeira categoria para organizar os produtos."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-brand-navy text-white">
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Descrição</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {categorias.map((categoria) => (
            <tr key={categoria.id} className="border-t border-slate-200 hover:bg-slate-50">
              <td className="px-4 py-2">{categoria.nome}</td>
              <td className="px-4 py-2">{categoria.descricao}</td>
              <td className="px-4 py-2">
                <div className="flex gap-2">
                  <FormButton variant="secondary" onClick={() => onEdit(categoria)}>
                    Editar
                  </FormButton>
                  <FormButton variant="danger" onClick={() => onRemove(categoria)}>
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
