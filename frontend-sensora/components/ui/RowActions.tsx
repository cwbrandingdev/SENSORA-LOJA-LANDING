// Refinamento visual (Admin, tabelas de Produtos/Categorias/Clientes/
// Usuários) — mesmo padrão de ações (Editar/Remover) repetido em quatro
// tabelas, cada uma com seu próprio par de FormButton com texto. Extraído
// aqui só para não duplicar a mesma receita visual (botão icon-only com
// tooltip nativo + aria-label) quatro vezes; não decide QUAIS ações existem
// nem o que elas fazem — isso continua 100% no `onClick` de cada chamador.
// Acessibilidade: `title` (tooltip nativo) e `aria-label` usam o mesmo texto
// (ex.: "Editar", "Remover") que os botões de texto tinham antes, para que
// `getByRole("button", { name: ... })` continue funcionando sem alteração.
import type { ComponentType } from "react";

export type RowAction = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
};

type RowActionsProps = {
  actions: RowAction[];
};

export default function RowActions({ actions }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      {actions.map(({ label, icon: Icon, onClick, variant = "default", disabled }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 disabled:cursor-not-allowed disabled:opacity-50 ${
            variant === "danger"
              ? "hover:bg-red-50 hover:text-red-600"
              : "hover:bg-slate-100 hover:text-brand-navy"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
