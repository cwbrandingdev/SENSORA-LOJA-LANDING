"use client";

// Portado de frontend/components/layout/Sidebar.js — mesmo comportamento,
// com o mesmo ajuste de destaque de navegação já corrigido na Loja original
// (Dashboard só fica ativo em match exato, senão ficaria destacado em toda
// subrota de /workspace-x — Etapa 8.12, antes /admin). Usa FormButton (não
// Button) no logout porque precisa
// de onClick — Button.tsx da Landing é só wrapper de next/link.
//
// Etapa 6.6 (Dashboard Admin) — achado da auditoria: o Admin não tinha
// nenhuma resposividade (sidebar fixa de w-56, sem breakpoint algum). Agora
// vira gaveta em mobile (`open`/`onClose`, controlados por ProtectedLayout)
// com overlay e fecha sozinha ao trocar de rota; em `md:` e acima volta a
// ser exatamente a coluna estática de sempre (`md:static md:translate-x-0`),
// comportamento desktop preservado byte a byte. Sem framer-motion: o
// projeto não tem essa dependência instalada em lugar nenhum (confirmado em
// package.json/node_modules — só o comentário de MagneticLink.tsx já
// documentava isso) — a transição usa só Tailwind, mesmo padrão de
// PageFadeIn.tsx/Skeleton.tsx, com motion-reduce: respeitado.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tags,
  Users,
  ClipboardList,
  UserCog,
  Plug,
  Undo2,
  Home,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/lib/routes";
import { PerfilUsuario } from "@/lib/types/loja";
import FormButton from "@/components/ui/FormButton";

// Agrupamento por área (Catálogo/Vendas/Sistema) — só organização visual,
// nenhuma rota/permissão muda: as mesmas STAFF_ROLES/ADMIN-only de sempre
// continuam decididas abaixo, igual a antes.
export type SidebarLink = { href: string; label: string; icon: LucideIcon };
export type SidebarGroup = { label: string; links: SidebarLink[] };

const baseGroups: SidebarGroup[] = [
  {
    label: "Catálogo",
    links: [
      { href: ROUTES.PRODUTOS, label: "Produtos", icon: Package },
      { href: ROUTES.CATEGORIAS, label: "Categorias", icon: Tags },
    ],
  },
  {
    label: "Vendas",
    links: [
      { href: ROUTES.PEDIDOS, label: "Pedidos", icon: ClipboardList },
      { href: ROUTES.CLIENTES, label: "Clientes", icon: Users },
    ],
  },
];

// Mesmos grupos/permissões e mesma regra de destaque usados pela Sidebar —
// exportado para qualquer outra apresentação da navegação do Admin reusar
// sem duplicar (e sem risco de divergir das permissões).
export function useAdminNav() {
  const { logout, perfil } = useAuth();
  const pathname = usePathname();

  // Central de Integrações — ADMIN-only, mesmo padrão de "Usuários" acima
  // (concatenado só quando perfil === ADMIN). Proteção real continua sendo
  // o backend (ADMIN_ONLY_ROLES nos endpoints de status, ver
  // asaas.controller.ts/mail.controller.ts/imagekit.controller.ts) + o
  // guard de página em app/workspace-x/integracoes/page.tsx — isto aqui é só a
  // camada visual, não esconder o item bastaria para bloquear VENDEDOR.
  // Etapa 7 — "Devoluções" também é ADMIN-only (análise das devoluções;
  // o backend responde 403 ao VENDEDOR), entra no grupo "Vendas".
  const [catalogo, vendas] = baseGroups;
  const groups: SidebarGroup[] =
    perfil === PerfilUsuario.ADMIN
      ? [
          catalogo,
          {
            ...vendas,
            links: [
              ...vendas.links,
              { href: ROUTES.DEVOLUCOES, label: "Devoluções", icon: Undo2 },
            ],
          },
          {
            label: "Sistema",
            links: [
              { href: ROUTES.USUARIOS, label: "Usuários", icon: UserCog },
              { href: ROUTES.INTEGRACOES, label: "Integrações", icon: Plug },
            ],
          },
        ]
      : baseGroups;

  function isActive(href: string): boolean {
    return href === ROUTES.DASHBOARD
      ? pathname === href
      : pathname === href || pathname?.startsWith(`${href}/`) === true;
  }

  return { groups, isActive, logout, pathname };
}

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

const DASHBOARD_LINK: SidebarLink = { href: ROUTES.DASHBOARD, label: "Dashboard", icon: LayoutDashboard };

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const { groups, isActive, logout, pathname } = useAdminNav();
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const campoBusca = useRef<HTMLInputElement>(null);

  // Fecha a gaveta sozinha ao navegar (mobile) — em desktop `open` nunca
  // chega a importar (a sidebar é sempre visível via md:translate-x-0), mas
  // chamar onClose() aqui de qualquer forma é inofensivo (só zera um estado
  // que já não afeta o layout desktop).
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Atalho "/" (fora de um campo de texto) foca a busca "Ir para…".
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const alvo = event.target as HTMLElement | null;
      const digitando =
        alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
      if (event.key === "/" && !digitando) {
        event.preventDefault();
        campoBusca.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Busca "Ir para…": filtra as páginas pelo nome enquanto digita; Enter
  // abre a primeira encontrada (destacada na lista). Só navegação — as
  // mesmas páginas/permissões de useAdminNav, nenhuma rota nova.
  const busca = termo.trim().toLowerCase();
  const casa = (link: SidebarLink) => !busca || link.label.toLowerCase().includes(busca);
  const secoes = [{ label: "", links: [DASHBOARD_LINK] }, ...groups]
    .map((secao) => ({ ...secao, links: secao.links.filter(casa) }))
    .filter((secao) => secao.links.length > 0);
  const primeiro = busca ? secoes[0]?.links[0] : undefined;

  function irParaPrimeiro(event: React.FormEvent) {
    event.preventDefault();
    if (!primeiro) return;
    router.push(primeiro.href);
    setTermo("");
    campoBusca.current?.blur();
  }

  return (
    <>
      {/* Overlay — só existe (no DOM) enquanto a gaveta está aberta, e só em
          mobile (md:hidden): evita um elemento clicável invisível sobrando
          por cima do conteúdo em desktop. */}
      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-brand-navy/40 backdrop-blur-[1px] md:hidden"
        />
      )}

      <nav
        aria-label="Navegação administrativa"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col justify-between overflow-y-auto bg-brand-navy px-3 py-5 transition-transform duration-300 ease-in-out motion-reduce:transition-none md:static md:z-auto md:w-60 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-5">
          <form role="search" onSubmit={irParaPrimeiro} className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
              aria-hidden
            />
            <input
              ref={campoBusca}
              type="search"
              value={termo}
              onChange={(event) => setTermo(event.target.value)}
              placeholder="Ir para…"
              aria-label="Ir para uma página do painel"
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-8 text-sm text-white placeholder:text-white/40 focus:border-brand-orange focus:outline-none"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/20 px-1.5 text-[10px] text-white/40 md:block">
              /
            </kbd>
          </form>

          {secoes.length === 0 ? (
            <p className="px-3 text-sm text-white/50">Nenhuma página encontrada.</p>
          ) : (
            secoes.map((secao) => (
              <div key={secao.label || "inicio"} className="flex flex-col gap-1">
                {secao.label && (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    {secao.label}
                  </p>
                )}
                <ul className="flex flex-col gap-1">
                  {secao.links.map((link) => {
                    const Icon = link.icon;
                    const active = isActive(link.href);
                    const destaque = link === primeiro;

                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setTermo("")}
                          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            active
                              ? "bg-brand-orange text-white"
                              : destaque
                                ? "bg-white/15 text-white"
                                : "text-white/80 hover:bg-brand-navy-light hover:text-white"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          {link.label}
                          {destaque && <span className="ml-auto text-[10px] text-white/50">Enter ↵</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Saída do admin — junto do "Sair", não no Header: as duas são
            formas de deixar o painel (uma para o site público, outra para o
            login), e ficar aqui evita disputar espaço com e-mail/perfil no
            Header mobile. */}
        <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-brand-navy-light hover:text-white"
          >
            <Home className="h-4 w-4 shrink-0" aria-hidden />
            Voltar para a home
          </Link>
          <FormButton variant="danger" onClick={logout} className="w-full">
            Sair
          </FormButton>
        </div>
      </nav>
    </>
  );
}
