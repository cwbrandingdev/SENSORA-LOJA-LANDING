"use client";

// Portado de frontend/components/layout/Sidebar.js — mesmo comportamento,
// com o mesmo ajuste de destaque de navegação já corrigido na Loja original
// (Dashboard só fica ativo em match exato, senão ficaria destacado em toda
// subrota de /admin). Usa FormButton (não Button) no logout porque precisa
// de onClick — Button.tsx da Landing é só wrapper de next/link.
import Link from "next/link";
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

export default function Sidebar() {
  const { logout, perfil } = useAuth();
  const pathname = usePathname();

  const links =
    perfil === PerfilUsuario.ADMIN
      ? [...baseLinks, { href: ROUTES.USUARIOS, label: "Usuários" }]
      : baseLinks;

  return (
    <nav className="flex w-56 shrink-0 flex-col justify-between bg-brand-navy px-3 py-4">
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
  );
}
