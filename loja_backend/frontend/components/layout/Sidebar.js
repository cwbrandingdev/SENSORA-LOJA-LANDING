"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  LayoutDashboard,
  Package,
  Tags,
  Users,
  ShoppingCart,
  UserCog,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAdminUI } from "@/context/AdminUIContext";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/cn";
import Button from "@/components/ui/Button";
import Logo from "@/components/ui/Logo";

const baseLinks = [
  { href: ROUTES.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { href: ROUTES.PRODUTOS, label: "Produtos", icon: Package },
  { href: ROUTES.CATEGORIAS, label: "Categorias", icon: Tags },
  { href: ROUTES.CLIENTES, label: "Clientes", icon: Users },
  { href: ROUTES.PEDIDOS, label: "Pedidos", icon: ShoppingCart },
];

function isActive(pathname, href) {
  return href === ROUTES.DASHBOARD
    ? pathname === href
    : pathname === href || pathname?.startsWith(`${href}/`);
}

function SidebarLinks({ links, pathname, collapsed, onNavigate }) {
  return (
    <ul className="flex flex-col gap-1">
      {links.map((link) => {
        const Icon = link.icon;
        const active = isActive(pathname, link.href);

        return (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onNavigate}
              title={collapsed ? link.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                active
                  ? "bg-brand-orange text-white"
                  : "text-slate-200 hover:bg-brand-navy-light hover:text-white"
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-all duration-200",
                  collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                )}
              >
                {link.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function Sidebar() {
  const { logout, perfil } = useAuth();
  const pathname = usePathname();
  const { mobileOpen, setMobileOpen, collapsed, toggleCollapsed } =
    useAdminUI();

  const links =
    perfil === "ADMIN"
      ? [...baseLinks, { href: ROUTES.USUARIOS, label: "Usuários", icon: UserCog }]
      : baseLinks;

  return (
    <>
      {/* Desktop */}
      <nav
        className={cn(
          "hidden shrink-0 flex-col justify-between bg-brand-navy transition-[width] duration-300 ease-in-out md:flex",
          collapsed ? "w-16" : "w-56"
        )}
      >
        <div className="flex flex-col gap-1 px-2 py-4">
          <SidebarLinks links={links} pathname={pathname} collapsed={collapsed} />
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 px-2 py-4">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors duration-150 hover:bg-brand-navy-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {collapsed ? (
              <ChevronsRight size={18} className="mx-auto" />
            ) : (
              <>
                <ChevronsLeft size={18} className="shrink-0" />
                <span>Recolher</span>
              </>
            )}
          </button>

          <Button
            variant="danger"
            onClick={logout}
            className={cn("w-full gap-2", collapsed ? "justify-center px-0" : "justify-center")}
            title={collapsed ? "Sair" : undefined}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && "Sair"}
          </Button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 md:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-brand-navy shadow-xl outline-none transition-transform duration-300 ease-out data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0 md:hidden">
            <Dialog.Title className="sr-only">Menu de navegação</Dialog.Title>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <Logo className="h-8 w-auto" />
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  className="rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex flex-1 flex-col justify-between overflow-y-auto px-2 py-4">
              <SidebarLinks
                links={links}
                pathname={pathname}
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
              />

              <div className="px-1 pt-4">
                <Button
                  variant="danger"
                  onClick={logout}
                  className="w-full justify-center gap-2"
                >
                  <LogOut size={16} />
                  Sair
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
