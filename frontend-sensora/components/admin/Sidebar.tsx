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
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/lib/routes";
import { PerfilUsuario } from "@/lib/types/loja";
import FormButton from "@/components/ui/FormButton";

const baseLinks = [
  { href: ROUTES.DASHBOARD, label: "Dashboard" },
  { href: ROUTES.PRODUTOS, label: "Produtos" },
  { href: ROUTES.CATEGORIAS, label: "Categorias" },
  { href: ROUTES.CLIENTES, label: "Clientes" },
  { href: ROUTES.PEDIDOS, label: "Pedidos" },
];

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const { logout, perfil } = useAuth();
  const pathname = usePathname();

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

  // Central de Integrações — ADMIN-only, mesmo padrão de "Usuários" acima
  // (concatenado só quando perfil === ADMIN). Proteção real continua sendo
  // o backend (ADMIN_ONLY_ROLES nos endpoints de status, ver
  // asaas.controller.ts/mail.controller.ts/imagekit.controller.ts) + o
  // guard de página em app/workspace-x/integracoes/page.tsx — isto aqui é só a
  // camada visual, não esconder o item bastaria para bloquear VENDEDOR.
  const links =
    perfil === PerfilUsuario.ADMIN
      ? [
          ...baseLinks,
          { href: ROUTES.USUARIOS, label: "Usuários" },
          { href: ROUTES.INTEGRACOES, label: "Integrações" },
        ]
      : baseLinks;

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
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col justify-between bg-brand-navy px-3 py-4 transition-transform duration-300 ease-in-out motion-reduce:transition-none md:static md:z-auto md:w-56 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ul className="flex flex-col gap-1">
          {links.map((link) => {
            const active =
              link.href === ROUTES.DASHBOARD
                ? pathname === link.href
                : pathname === link.href || pathname?.startsWith(`${link.href}/`);

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-orange text-white"
                      : "text-white/80 hover:bg-brand-navy-light hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <FormButton variant="danger" onClick={logout} className="w-full">
          Sair
        </FormButton>
      </nav>
    </>
  );
}
