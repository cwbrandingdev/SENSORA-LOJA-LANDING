// Portado de frontend/components/tables/ProductTable.js — mesmo
// comportamento e colunas.
import FormButton from "@/components/ui/FormButton";
import EmptyState from "@/components/ui/EmptyState";
import type { Categoria, Produto } from "@/lib/types/loja";

type ProductTableProps = {
  produtos: Produto[];
  /** GET /produtos (admin) só devolve `categoriaId`, sem a categoria
   *  aninhada (diferente de /public/produtos) — resolvemos o nome aqui no
   *  front cruzando com a lista de categorias já carregada pela página. */
  categorias: Categoria[];
  onEdit: (produto: Produto) => void;
  onRemove: (produto: Produto) => void;
};

export default function ProductTable({ produtos, categorias, onEdit, onRemove }: ProductTableProps) {
  if (!produtos || produtos.length === 0) {
    return (
      <EmptyState
        compact
        eyebrow="Produtos"
        title="Nenhum produto cadastrado"
        message="Cadastre o primeiro produto para começar."
      />
    );
  }

  function nomeCategoria(produto: Produto): string {
    if (produto.categoria?.nome) return produto.categoria.nome;
    return categorias.find((categoria) => categoria.id === produto.categoriaId)?.nome ?? "—";
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-brand-navy text-white">
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Categoria</th>
            <th className="px-4 py-2 font-medium">Preço</th>
            <th className="px-4 py-2 font-medium">Estoque</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {produtos.map((produto) => (
            <tr key={produto.id} className="border-t border-slate-200 hover:bg-slate-50">
              <td className="px-4 py-2">{produto.nome}</td>
              <td className="px-4 py-2 text-slate-600">{nomeCategoria(produto)}</td>
              <td className="px-4 py-2">{produto.preco}</td>
              <td className="px-4 py-2">{produto.quantidade}</td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={produto.ativo ? "text-slate-700" : "text-slate-400"}>
                    {produto.ativo ? "Ativo" : "Inativo"}
                  </span>
                  {produto.destaque && (
                    <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-[11px] font-medium text-brand-orange">
                      Destaque
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-2">
                <div className="flex gap-2">
                  <FormButton variant="secondary" onClick={() => onEdit(produto)}>
                    Editar
                  </FormButton>
                  <FormButton variant="danger" onClick={() => onRemove(produto)}>
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
