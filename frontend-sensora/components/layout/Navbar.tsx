"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { NAV_CATEGORIES } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { loginComRedirect } from "@/lib/auth-redirect";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { PerfilUsuario, STAFF_ROLES } from "@/lib/types/loja";
import { cn } from "@/lib/utils";

const CATEGORY_LINKS = NAV_CATEGORIES.filter((item) => item.href !== ROUTES.LOJA);

function NavLink({
  href,
  className,
  children,
  onClick,
  active,
}: {
  href?: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const classes = cn(
    "rounded-full px-3 py-1.5 text-[15px] font-medium tracking-tight text-brand-navy/80 transition-colors duration-300 hover:bg-slate-100 hover:text-brand-navy",
    active && "bg-slate-100 text-brand-navy",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} onClick={onClick}>
      {children}
    </button>
  );
}

function IconLink({
  href,
  label,
  badge,
  children,
  onClick,
}: {
  href: string;
  label: string;
  badge?: number;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      onClick={onClick}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-navy/85 transition-colors duration-300 hover:bg-slate-100 hover:text-brand-navy"
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-brand-navy px-1 text-[10px] font-semibold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { totalItens } = useCart();
  const pathname = usePathname();
  const { isAuthenticated, loading, perfil, logout } = useAuth();

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

  const isActive = (href: string) =>
    pathname === href || Boolean(pathname?.startsWith(`${href}/`));

  const mobileLinkClass =
    "flex items-center rounded-2xl px-4 py-3 text-base font-medium tracking-tight text-brand-navy/85 transition-colors duration-300 hover:bg-slate-100 hover:text-brand-navy";

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 font-rounded">
      <div className="pointer-events-auto mx-auto max-w-[96rem] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 lg:px-8">
        <div
          className={cn(
            "overflow-hidden border border-slate-200 bg-white text-brand-navy shadow-[0_8px_28px_rgba(15,23,42,0.08)] transition-[border-radius,background-color,color] duration-300 ease-out motion-reduce:transition-none",
            open ? "rounded-[2rem]" : "rounded-full",
          )}
        >
          <div className="grid grid-cols-[auto_1fr] items-center gap-3 px-4 py-2.5 sm:px-5 lg:grid-cols-[1fr_auto_1fr] lg:px-7">
            <Link
              href="/"
              aria-label="Sensora, ir para o início"
              className="flex shrink-0 items-center justify-self-start rounded-full px-1 py-0.5"
              onClick={() => setOpen(false)}
            >
              <Logo
                variant="dark"
                showTagline={false}
                className="h-8"
                imageClassName="h-8 w-auto"
              />
            </Link>

            <nav aria-label="Categorias de produtos" className="hidden lg:block">
              <ul className="flex items-center gap-0.5">
                {CATEGORY_LINKS.map((item) => (
                  <li key={item.label}>
                    <NavLink href={item.href} active={isActive(item.href)}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="flex items-center justify-self-end gap-1 sm:gap-1.5">
              <IconLink
                href={ROUTES.LOJA_CARRINHO}
                label={
                  totalItens > 0
                    ? `Carrinho, ${totalItens} ${totalItens === 1 ? "item" : "itens"}`
                    : "Carrinho"
                }
                badge={totalItens}
              >
                <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </IconLink>

              {!loading && (
                <>
                  <IconLink href={contaHref} label={contaLabel}>
                    <UserRound className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </IconLink>
                  {isAuthenticated && (
                    <NavLink onClick={logout} className="hidden px-2.5 text-sm lg:inline-flex">
                      Sair
                    </NavLink>
                  )}
                </>
              )}

              <Link
                href={ROUTES.LOJA}
                className="hidden items-center justify-center rounded-full bg-brand-navy px-5 py-2.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-300 hover:bg-brand-navy-light sm:inline-flex"
              >
                Adquira já
              </Link>

              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-label={open ? "Fechar menu" : "Abrir menu"}
                aria-expanded={open}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-navy transition-colors duration-300 hover:bg-slate-100 lg:hidden"
              >
                {open ? (
                  <X className="h-5 w-5" strokeWidth={1.75} />
                ) : (
                  <Menu className="h-5 w-5" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          <nav
            aria-label="Categorias de produtos"
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out lg:hidden motion-reduce:transition-none",
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <ul className="min-h-0 overflow-hidden px-3 pb-3">
              {CATEGORY_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      mobileLinkClass,
                      isActive(item.href) && "bg-slate-100 text-brand-navy",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={ROUTES.LOJA_CARRINHO}
                  onClick={() => setOpen(false)}
                  className={cn(mobileLinkClass, "justify-between")}
                >
                  Carrinho
                  {totalItens > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-navy px-1 text-[11px] font-semibold text-white">
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
              <li className="pt-1 sm:hidden">
                <Link
                  href={ROUTES.LOJA}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center rounded-full bg-brand-navy px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-white"
                >
                  Adquira já
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
