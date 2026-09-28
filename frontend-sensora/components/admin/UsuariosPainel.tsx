"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MailWarning, Search, ShieldCheck, UserCog, Users, X } from "lucide-react";
import UserTable from "@/components/tables/UserTable";
import EmptyState from "@/components/ui/EmptyState";
import InlineErrorState from "@/components/ui/InlineErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { PerfilUsuario, type Usuario } from "@/lib/types/loja";

// Lista de usuários do Admin: números de resumo, busca/filtros (só no
// navegador, sem chamada nova à API) e a tabela. O formulário de
// criar/editar abre num painel lateral à direita. Toda a lógica
// (carregar/criar/editar/remover) continua na página.

const PERFIL_PLURAL: Record<PerfilUsuario, string> = {
  [PerfilUsuario.ADMIN]: "Administradores",
  [PerfilUsuario.VENDEDOR]: "Vendedores",
  [PerfilUsuario.CLIENTE]: "Clientes",
};

const ORDEM_PERFIS = [PerfilUsuario.ADMIN, PerfilUsuario.VENDEDOR, PerfilUsuario.CLIENTE];

type FiltroPerfil = "todos" | PerfilUsuario;
type FiltroStatus = "todos" | "nao-verificado" | "inativo";

type Props = {
  usuarios: Usuario[];
  loading: boolean;
  erro: string | null;
  onRetry: () => void;
  onEdit: (usuario: Usuario) => void;
  onRemove: (usuario: Usuario) => void;
  /** Formulário de criar/editar já montado pela página (ou null se fechado). */
  formulario: ReactNode | null;
  onFecharFormulario: () => void;
};

function Resumo({ usuarios }: { usuarios: Usuario[] }) {
  const itens = [
    { rotulo: "Total", valor: usuarios.length, icone: Users, tom: "text-brand-navy bg-brand-navy/5" },
    {
      rotulo: "Administradores",
      valor: usuarios.filter((u) => u.perfil === PerfilUsuario.ADMIN).length,
      icone: ShieldCheck,
      tom: "text-sky-700 bg-sky-50",
    },
    {
      rotulo: "Clientes",
      valor: usuarios.filter((u) => u.perfil === PerfilUsuario.CLIENTE).length,
      icone: UserCog,
      tom: "text-slate-700 bg-slate-100",
    },
    {
      rotulo: "E-mail não verificado",
      valor: usuarios.filter((u) => !u.emailVerificado).length,
      icone: MailWarning,
      tom: "text-amber-700 bg-amber-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map(({ rotulo, valor, icone: Icone, tom }) => (
        <div key={rotulo} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tom}`}>
            <Icone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{valor}</p>
            <p className="truncate text-xs text-slate-500">{rotulo}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListaFiltrada({ usuarios, onEdit, onRemove }: Pick<Props, "usuarios" | "onEdit" | "onRemove">) {
  const [busca, setBusca] = useState("");
  const [perfil, setPerfil] = useState<FiltroPerfil>("todos");
  const [status, setStatus] = useState<FiltroStatus>("todos");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (termo && !u.nome.toLowerCase().includes(termo) && !u.email.toLowerCase().includes(termo)) {
        return false;
      }
      if (perfil !== "todos" && u.perfil !== perfil) return false;
      if (status === "nao-verificado" && u.emailVerificado) return false;
      if (status === "inativo" && u.ativo) return false;
      return true;
    });
  }, [usuarios, busca, perfil, status]);

  const chip = (ativo: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
      ativo ? "bg-brand-navy text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
    }`;

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-xs">
          <span className="sr-only">Buscar usuário</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(perfil === "todos")} onClick={() => setPerfil("todos")}>
            Todos
          </button>
          {ORDEM_PERFIS.map((p) => (
            <button key={p} type="button" className={chip(perfil === p)} onClick={() => setPerfil(p)}>
              {PERFIL_PLURAL[p]}
            </button>
          ))}
          <span aria-hidden className="mx-1 hidden w-px bg-slate-200 sm:block" />
          <button
            type="button"
            className={chip(status === "nao-verificado")}
            onClick={() => setStatus(status === "nao-verificado" ? "todos" : "nao-verificado")}
          >
            Não verificados
          </button>
          <button
            type="button"
            className={chip(status === "inativo")}
            onClick={() => setStatus(status === "inativo" ? "todos" : "inativo")}
          >
            Inativos
          </button>
        </div>
      </div>

      {filtrados.length === 0 && usuarios.length > 0 ? (
        <EmptyState
          compact
          eyebrow="Usuários"
          title="Nenhum usuário encontrado"
          message="Ajuste a busca ou os filtros."
          icon={UserCog}
        />
      ) : (
        <UserTable usuarios={filtrados} onEdit={onEdit} onRemove={onRemove} />
      )}
    </>
  );
}

/** Painel lateral à direita para o formulário. Fecha pelo X, clicando fora
 *  ou com Esc. */
function PainelFormulario({ onFechar, children }: { onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Formulário de usuário">
      <button
        type="button"
        aria-label="Fechar formulário"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onFechar}
      />
      <div className="relative ml-auto h-full w-full max-w-md overflow-y-auto bg-slate-50 p-4 shadow-2xl sm:rounded-xl">
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-500 hover:bg-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pt-8">{children}</div>
      </div>
    </div>
  );
}

export default function UsuariosPainel({
  usuarios,
  loading,
  erro,
  onRetry,
  onEdit,
  onRemove,
  formulario,
  onFecharFormulario,
}: Props) {
  return (
    <>
      {loading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : erro ? (
        <InlineErrorState message={erro} onRetry={onRetry} />
      ) : (
        <div className="flex flex-col gap-4">
          <Resumo usuarios={usuarios} />
          <ListaFiltrada usuarios={usuarios} onEdit={onEdit} onRemove={onRemove} />
        </div>
      )}

      {formulario && <PainelFormulario onFechar={onFecharFormulario}>{formulario}</PainelFormulario>}
    </>
  );
}
