"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/ui/Logo";
import { NAV_CATEGORIES } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { loginComRedirect } from "@/lib/auth-redirect";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { PerfilUsuario, STAFF_ROLES } from "@/lib/types/loja";
import { useNavbarScroll } from "@/hooks/useNavbarScroll";
import { cn } from "@/lib/utils";

function NavLink({
  href,
  className,
  children,
  onClick,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const classes = cn(
    "group relative inline-block text-base font-medium tracking-wide text-slate-600 transition-colors duration-300 hover:text-brand-orange",
    className,
  );

  const underline = (
    <span
      aria-hidden
      className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
    />
  );

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
        {underline}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} onClick={onClick}>
      {children}
      {underline}
    </button>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { totalItens } = useCart();
  const pathname = usePathname();
  const { isAuthenticated, loading, perfil, logout } = useAuth();
  const { progress, isHome } = useNavbarScroll();

  let contaLabel = "Entrar";
  let contaHref: string = loginComRedirect(pathname ?? "/");
  if (isAuthenticated) {
    if (perfil === PerfilUsuario.CLIENTE) {
      contaLabel = "Minha conta";
      contaHref = ROUTES.CONTA;
    } else if (perfil !== null && STAFF_ROLES.includes(perfil)) {
      contaLabel = "Painel administrativo";
      contaHref = ROUTES.DASHBOARD;
    }
  }

  const heroOpacity = isHome ? 1 - progress : 0;

  const headerStyle = {
    "--nav-progress": progress,
    backgroundColor: `color-mix(in srgb, var(--background) ${heroOpacity * 100}%, transparent)`,
    borderBottomColor: `rgba(15, 23, 42, ${heroOpacity * 0.08})`,
    boxShadow: `0 1px 12px rgba(15, 23, 42, ${heroOpacity * 0.06})`,
  } as CSSProperties;

  const mobileLinkClass =
    "block rounded-md px-2 py-3 text-sm font-medium tracking-wide text-slate-600 transition-colors duration-300 hover:bg-black/5 hover:text-brand-orange";

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-transparent backdrop-blur-[2px] transition-[background-color,border-color,box-shadow] duration-500 ease-out motion-reduce:transition-none"
      style={headerStyle}
    >
      <div className="flex items-center justify-between px-4 py-4 md:hidden">
        <Link href="/" aria-label="Sensora, ir para o início">
          <Logo variant="dark" showTagline className="scale-90" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          className="flex h-9 w-9 flex-col items-center justify-center gap-1.5"
        >
          <span
            className="h-0.5 w-6 bg-slate-800 transition-[transform,background-color] duration-500"
            style={{
              transform: open ? "translateY(8px) rotate(45deg)" : undefined,
            }}
          />
          <span
            className="h-0.5 w-6 bg-slate-800 transition-[opacity,background-color] duration-500"
            style={{
              opacity: open ? 0 : 1,
            }}
          />
          <span
            className="h-0.5 w-6 bg-slate-800 transition-[transform,background-color] duration-500"
            style={{
              transform: open ? "translateY(-8px) rotate(-45deg)" : undefined,
            }}
          />
        </button>
      </div>

      <div className="mx-auto hidden max-w-7xl items-center justify-between px-6 py-4 md:flex lg:px-10">
        <Link href="/" aria-label="Sensora, ir para o início">
          <Logo variant="dark" showTagline={false} className="scale-90" />
        </Link>
        <nav aria-label="Categorias de produtos">
          <ul className="flex items-center gap-9">
            {NAV_CATEGORIES.map((item) => (
              <li key={item.label}>
                <NavLink href={item.href}>
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li>
              <NavLink
                href={ROUTES.LOJA_CARRINHO}
                className="inline-flex items-center gap-1.5"
              >
                Carrinho
                {totalItens > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-orange px-1 text-[11px] font-semibold text-white">
                    {totalItens}
                  </span>
                )}
              </NavLink>
            </li>
            {!loading && (
              <>
                <li>
                  <NavLink href={contaHref}>
                    {contaLabel}
                  </NavLink>
                </li>
                {isAuthenticated && (
                  <li>
                    <NavLink onClick={logout}>
                      Sair
                    </NavLink>
                  </li>
                )}
              </>
            )}
          </ul>
        </nav>
      </div>

      <nav
        aria-label="Categorias de produtos"
        className={cn(
          "overflow-hidden bg-background transition-[max-height] duration-300 md:hidden",
          open ? "max-h-96" : "max-h-0",
        )}
      >
        <ul className="flex flex-col gap-1 px-6 pb-4">
          {NAV_CATEGORIES.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={mobileLinkClass}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={ROUTES.LOJA_CARRINHO}
              onClick={() => setOpen(false)}
              className={cn(mobileLinkClass, "flex items-center gap-1.5")}
            >
              Carrinho
              {totalItens > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-orange px-1 text-[11px] font-semibold text-white">
                  {totalItens}
                </span>
              )}
            </Link>
          </li>
          {!loading && (
            <>
              <li>
                <Link
                  href={contaHref}
                  onClick={() => setOpen(false)}
                  className={mobileLinkClass}
                >
                  {contaLabel}
                </Link>
              </li>
              {isAuthenticated && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className={cn(mobileLinkClass, "w-full text-left")}
                  >
                    Sair
                  </button>
                </li>
              )}
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}
