// Portado de frontend/components/tables/ClientTable.js — mesmo
// comportamento e colunas.
//
// Refinamento visual (Admin) — cabeçalho claro, mesmo padrão de
// PedidoTable.tsx/ProductTable.tsx. Nenhuma coluna/ação removida.
//
// Rodada 2 (padrão ERP/SaaS, referência 21st.dev) — CPF/Endereço (dados
// existentes, mas secundários para a leitura rápida da lista) ganharam
// tipografia mais discreta (text-xs/slate-400) em vez do mesmo peso visual
// de Nome/Email/Telefone; nenhum dos dois foi removido. Ações viraram
// ícones com tooltip (RowActions.tsx), mesmo texto acessível
// ("Editar"/"Remover") de antes.
//
// `table-fixed` com largura explícita por coluna (em vez do table-layout:
// auto padrão) — com 6 colunas de texto livre (nome/email/endereço podem
// ser bem longos), o layout automático estava alocando mais espaço do que
// o necessário a colunas curtas (Telefone/CPF) e empurrando "Ações" para
// fora da área visível do wrapper `overflow-x-auto`, exigindo scroll
// horizontal só para editar/remover — reproduzido e corrigido durante o
// refinamento visual (ver screenshots de QA). Com larguras fixas, o total
// (~890px) só dispara o scroll em telas realmente estreitas, e "Ações"
// nunca fica escondida no meio do caminho.
import { Pencil, Trash2, Users } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import RowActions from "@/components/ui/RowActions";
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
        icon={Users}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full table-fixed text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th className="w-[180px] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Nome
            </th>
            <th className="w-[210px] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Email
            </th>
            <th className="w-[130px] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Telefone
            </th>
            <th className="w-[110px] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              CPF
            </th>
            <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Endereço
            </th>
            <th className="w-[96px] px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {clientes.map((cliente) => (
            <tr key={cliente.id} className="transition-colors hover:bg-slate-50/70">
              <td className="px-5 py-4">
                <p className="truncate font-medium text-slate-900" title={cliente.nome}>
                  {cliente.nome}
                </p>
              </td>
              <td className="px-5 py-4">
                <p className="truncate text-slate-600" title={cliente.email}>
                  {cliente.email}
                </p>
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-slate-600">{cliente.telefone}</td>
              <td className="px-5 py-4 text-xs tabular-nums text-slate-400">{cliente.cpf}</td>
              <td className="px-5 py-4">
                <p className="truncate text-xs text-slate-400" title={cliente.endereco}>
                  {cliente.endereco}
                </p>
              </td>
              <td className="px-5 py-4">
                <RowActions
                  actions={[
                    { label: "Editar", icon: Pencil, onClick: () => onEdit(cliente) },
                    {
                      label: "Remover",
                      icon: Trash2,
                      variant: "danger",
                      onClick: () => onRemove(cliente),
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
