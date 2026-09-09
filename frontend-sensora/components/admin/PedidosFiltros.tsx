// Filtros de /workspace-x/pedidos — inteiramente client-side, sobre a lista
// que GET /pedidos já devolve (nenhum parâmetro novo enviado ao backend,
// nenhum endpoint novo). "Por mês" e "por dia" são cobertos pelo mesmo par
// De/Até (um intervalo de um único dia é "por dia"; do primeiro ao último
// dia do mês é "por mês") — evita três controles de data se sobrepondo.
import { StatusPedido } from "@/lib/types/loja";
import FormButton from "@/components/ui/FormButton";

export type PedidosFiltrosValue = {
  cliente: string;
  status: StatusPedido | "TODOS";
  dataDe: string;
  dataAte: string;
};

export const PEDIDOS_FILTROS_VAZIO: PedidosFiltrosValue = {
  cliente: "",
  status: "TODOS",
  dataDe: "",
  dataAte: "",
};

// Reaproveitado por PedidoTable.tsx (via PedidosPage) para distinguir "não
// há nenhum pedido cadastrado" de "nenhum pedido corresponde a este filtro"
// — mesma checagem usada aqui para mostrar/ocultar "Limpar filtros", nunca
// duplicada em dois lugares.
export function temFiltroAtivo(filtros: PedidosFiltrosValue): boolean {
  return (
    filtros.cliente.trim() !== "" ||
    filtros.status !== "TODOS" ||
    filtros.dataDe !== "" ||
    filtros.dataAte !== ""
  );
}

// Mesmos rótulos de StatusPedidoBadge.tsx (components/conta) — só os status
// que já existem em StatusPedido, nenhum valor novo.
const STATUS_LABEL: Record<StatusPedido, string> = {
  [StatusPedido.PENDENTE]: "Pendente",
  [StatusPedido.PAGO]: "Pago",
  [StatusPedido.CANCELADO]: "Cancelado",
  [StatusPedido.REEMBOLSO_SOLICITADO]: "Reembolso solicitado",
  [StatusPedido.REEMBOLSADO]: "Reembolsado",
};

type PedidosFiltrosProps = {
  value: PedidosFiltrosValue;
  onChange: (value: PedidosFiltrosValue) => void;
};

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-xs font-medium text-slate-500";

export default function PedidosFiltros({ value, onChange }: PedidosFiltrosProps) {
  const filtroAtivo = temFiltroAtivo(value);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-cliente" className={labelClass}>
          Cliente
        </label>
        <input
          id="filtro-cliente"
          type="text"
          placeholder="Nome ou e-mail"
          value={value.cliente}
          onChange={(e) => onChange({ ...value, cliente: e.target.value })}
          className={`${inputClass} w-48`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-status" className={labelClass}>
          Status
        </label>
        <select
          id="filtro-status"
          value={value.status}
          onChange={(e) =>
            onChange({ ...value, status: e.target.value as PedidosFiltrosValue["status"] })
          }
          className={`${inputClass} w-44`}
        >
          <option value="TODOS">Todos</option>
          {Object.values(StatusPedido).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-data-de" className={labelClass}>
          De
        </label>
        <input
          id="filtro-data-de"
          type="date"
          value={value.dataDe}
          onChange={(e) => onChange({ ...value, dataDe: e.target.value })}
          className={`${inputClass} w-40`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-data-ate" className={labelClass}>
          Até
        </label>
        <input
          id="filtro-data-ate"
          type="date"
          value={value.dataAte}
          onChange={(e) => onChange({ ...value, dataAte: e.target.value })}
          className={`${inputClass} w-40`}
        />
      </div>

      {filtroAtivo && (
        <FormButton variant="ghost" onClick={() => onChange(PEDIDOS_FILTROS_VAZIO)}>
          Limpar filtros
        </FormButton>
      )}
    </div>
  );
}
