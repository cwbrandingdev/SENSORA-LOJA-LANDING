"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import { NAV_CATEGORIES } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { loginComRedirect } from "@/lib/auth-redirect";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { PerfilUsuario, STAFF_ROLES } from "@/lib/types/loja";
import { cn } from "@/lib/utils";

const CATEGORY_LINKS = NAV_CATEGORIES.filter(
  (item) => item.href !== ROUTES.LOJA,
);

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
  className,
}: {
  href: string;
  label: string;
  badge?: number;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center text-brand-navy/70 transition-colors duration-300 hover:text-brand-navy",
        className,
      )}
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { totalItens } = useCart();
  const pathname = usePathname();
  const router = useRouter();
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

  const cartLabel =
    totalItens > 0
      ? `Carrinho, ${totalItens} ${totalItens === 1 ? "item" : "itens"}`
      : "Carrinho";

  const mobileLinkClass =
    "flex items-center py-3 text-[15px] font-medium tracking-[0.08em] text-brand-navy/80 transition-colors duration-300 hover:text-brand-navy";

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
  }, [searchOpen]);

  function toggleMenu() {
    setSearchOpen(false);
    setMenuOpen((value) => !value);
  }

  function toggleSearch() {
    setMenuOpen(false);
    setSearchOpen((value) => !value);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) {
      router.push(ROUTES.LOJA_PRODUTOS);
    } else {
      router.push(
        `${ROUTES.LOJA_PRODUTOS}?q=${encodeURIComponent(term)}`,
      );
    }
    setSearchOpen(false);
    setQuery("");
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 font-rounded">
      <div className="pointer-events-auto lg:hidden">
        <div className="border-b border-stone-200/80 bg-background">
          <div className="grid h-14 grid-cols-3 items-center px-4">
            <button
              type="button"
              onClick={toggleMenu}
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              className="inline-flex h-10 w-10 items-center justify-start text-brand-navy/70 transition-colors hover:text-brand-navy"
            >
              {menuOpen ? (
                <X className="h-6 w-6" strokeWidth={1.5} />
              ) : (
                <Menu className="h-6 w-6" strokeWidth={1.5} />
              )}
            </button>

            <Link
              href="/"
              aria-label="Sensora, ir para o início"
              className="justify-self-center"
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen(false);
              }}
            >
              <Logo
                variant="dark"
                showTagline={false}
                className="h-7"
                imageClassName="h-7 w-auto"
              />
            </Link>

            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={toggleSearch}
                aria-label={searchOpen ? "Fechar busca" : "Buscar produtos"}
                aria-expanded={searchOpen}
                className="inline-flex h-10 w-10 items-center justify-center text-brand-navy/70 transition-colors hover:text-brand-navy"
              >
                <Search className="h-[22px] w-[22px]" strokeWidth={1.5} />
              </button>
              <IconLink href={ROUTES.LOJA_CARRINHO} label={cartLabel} badge={totalItens}>
                <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={1.5} />
              </IconLink>
            </div>
          </div>

          {searchOpen && (
            <form
              onSubmit={handleSearch}
              className="border-t border-stone-200/80 px-4 py-3"
            >
              <label htmlFor="navbar-search" className="sr-only">
                Buscar produtos
              </label>
              <input
                id="navbar-search"
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar produtos"
                className="w-full border-b border-brand-navy/20 bg-transparent py-2 text-[15px] text-brand-navy outline-none placeholder:text-brand-navy/40"
              />
            </form>
          )}
        </div>

        {menuOpen && (
          <nav
            aria-label="Menu"
            className="h-[calc(100dvh-3.5rem)] overflow-y-auto bg-background px-6 py-8"
          >
            <ul className="flex flex-col">
              {CATEGORY_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      mobileLinkClass,
                      isActive(item.href) && "text-brand-navy",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={ROUTES.LOJA}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    mobileLinkClass,
                    isActive(ROUTES.LOJA) && "text-brand-navy",
                  )}
                >
                  Loja
                </Link>
              </li>
              {!loading && (
                <>
                  <li className="mt-6 border-t border-stone-200/80 pt-4">
                    <Link
                      href={contaHref}
                      onClick={() => setMenuOpen(false)}
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
                          setMenuOpen(false);
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
        )}
      </div>

      <div className="pointer-events-auto mx-auto hidden max-w-[96rem] px-5 pt-[max(0.75rem,env(safe-area-inset-top))] lg:block lg:px-8">
        <div className="overflow-hidden rounded-full border border-slate-200 bg-white text-brand-navy shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-7 py-2.5">
            <Link
              href="/"
              aria-label="Sensora, ir para o início"
              className="flex shrink-0 items-center justify-self-start rounded-full px-1 py-0.5"
            >
              <Logo
                variant="dark"
                showTagline={false}
                className="h-8"
                imageClassName="h-8 w-auto"
              />
            </Link>

            <nav aria-label="Categorias de produtos">
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

            <div className="flex items-center justify-self-end gap-1.5">
              <IconLink
                href={ROUTES.LOJA_CARRINHO}
                label={cartLabel}
                badge={totalItens}
                className="rounded-full hover:bg-slate-100"
              >
                <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </IconLink>

              {!loading && (
                <>
                  <IconLink
                    href={contaHref}
                    label={contaLabel}
                    className="rounded-full hover:bg-slate-100"
                  >
                    <UserRound
                      className="h-[18px] w-[18px]"
                      strokeWidth={1.75}
                    />
                  </IconLink>
                  {isAuthenticated && (
                    <NavLink onClick={logout} className="px-2.5 text-sm">
                      Sair
                    </NavLink>
                  )}
                </>
              )}

              <Link
                href={ROUTES.LOJA}
                className="inline-flex items-center justify-center rounded-full bg-brand-navy px-5 py-2.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-white transition-colors duration-300 hover:bg-brand-navy-light"
              >
                Adquira já
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
