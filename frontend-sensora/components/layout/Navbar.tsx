"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Droplets,
  Flame,
  Gift,
  Menu,
  ShoppingBag,
  SprayCan,
  Store,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import NavbarSearch from "@/components/layout/NavbarSearch";
import { NAV_CATEGORIES } from "@/lib/content";
import { ROTAS_LEGAIS } from "@/lib/empresa";
import { ROUTES } from "@/lib/routes";
import { loginComRedirect } from "@/lib/auth-redirect";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { PerfilUsuario, STAFF_ROLES } from "@/lib/types/loja";
import { cn } from "@/lib/utils";

const ROTULOS_CURTOS: Record<string, string> = {
  "/velas": "Velas",
  "/sprays": "Sprays",
  "/difusores": "Difusores",
  "/colecoes": "Kits",
};

const CATEGORY_LINKS = [
  ...NAV_CATEGORIES.filter((item) => item.href !== ROUTES.LOJA).map((item) => ({
    ...item,
    label: ROTULOS_CURTOS[item.href] ?? item.label,
  })),
  { label: "Quem somos", href: ROTAS_LEGAIS.quemSomos },
];

const ICONES: Record<string, LucideIcon> = {
  "/velas": Flame,
  "/sprays": SprayCan,
  "/difusores": Droplets,
  "/colecoes": Gift,
  "/quem-somos": UsersRound,
  [ROUTES.LOJA_PRODUTOS]: Store,
};

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
  const { totalItens } = useCart();
  const pathname = usePathname();
  // Desktop: degradê navy só sobre o hero (home); fora dele a barra é branca.
  // Já começa branco nas outras páginas para não piscar o degradê.
  const [foraHero, setForaHero] = useState(pathname !== "/");
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
    const aoRolar = () => {
      // Hero = seção full-bleed no topo do <main> (ex.: HeroCarousel da home)
      const hero = document.querySelector("main > [data-full-bleed]");
      // Sem hero (páginas internas) a barra fica branca desde o topo
      setForaHero(!hero || hero.getBoundingClientRect().bottom <= 0);
    };
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, [pathname]);

  function toggleMenu() {
    setMenuOpen((value) => !value);
  }

  return (
    <>
      <header
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-50 font-rounded",
          // Menu mobile aberto precisa ficar acima do CookieConsentBanner
          // (também z-50, renderizado depois no DOM — empataria e o banner
          // venceria). max-lg: mantém o desktop em z-50, sem qualquer mudança,
          // mesmo no caso extremo de menuOpen permanecer true após um resize.
          menuOpen && "max-lg:z-60",
        )}
      >
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
                onClick={() => setMenuOpen(false)}
              >
                <Logo
                  variant="dark"
                  showTagline={false}
                  className="h-7"
                  imageClassName="h-7 w-auto"
                />
              </Link>

              <div className="flex items-center justify-end gap-1">
                <NavbarSearch variant="painel" recolher={menuOpen} />
                <IconLink
                  href={ROUTES.LOJA_CARRINHO}
                  label={cartLabel}
                  badge={totalItens}
                >
                  <ShoppingBag
                    className="h-[22px] w-[22px]"
                    strokeWidth={1.5}
                  />
                </IconLink>
              </div>
            </div>
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
                    href={ROUTES.LOJA_PRODUTOS}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      mobileLinkClass,
                      isActive(ROUTES.LOJA_PRODUTOS) && "text-brand-navy",
                    )}
                  >
                    Ver tudo
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

        <div
          className={cn(
            "pointer-events-auto hidden transition-[background-color,padding,box-shadow] duration-300 lg:block",
            foraHero
              ? "bg-white/95 shadow-[0_6px_24px_rgba(15,23,42,0.08)] backdrop-blur-md"
              : "bg-linear-to-b from-brand-navy/80 via-brand-navy/45 to-transparent pb-6 [text-shadow:0_1px_6px_rgba(0,0,0,0.35)]",
          )}
        >
          <div className="mx-auto grid h-18 max-w-384 grid-cols-[1fr_auto_1fr] items-center gap-6 px-8">
            <Link
              href="/"
              aria-label="Sensora, ir para o início"
              className="flex shrink-0 items-center justify-self-start"
            >
              <Logo
                variant={foraHero ? "dark" : "light"}
                showTagline={false}
                className="h-8"
                imageClassName="h-8 w-auto"
              />
            </Link>

            <nav aria-label="Categorias de produtos">
              <ul className="flex items-center gap-3">
                {[
                  ...CATEGORY_LINKS,
                  { label: "Ver tudo", href: ROUTES.LOJA_PRODUTOS },
                ].map((item) => {
                  const Icone = ICONES[item.href] ?? Store;
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex w-20 flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors",
                          foraHero
                            ? "text-brand-navy hover:bg-stone-100"
                            : "text-white hover:bg-white/15",
                          isActive(item.href) && "text-brand-orange",
                        )}
                      >
                        <Icone className="h-5.5 w-5.5" strokeWidth={1.9} />
                        <span className="text-[12px] font-semibold">
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="flex items-center gap-1 justify-self-end rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-white/60 backdrop-blur-md">
              <NavbarSearch variant="barra" />
              <IconLink
                href={ROUTES.LOJA_CARRINHO}
                label={cartLabel}
                badge={totalItens}
                className="rounded-full hover:bg-slate-100"
              >
                <ShoppingBag className="h-4.5 w-4.5" strokeWidth={1.75} />
              </IconLink>
              {!loading && (
                <IconLink
                  href={contaHref}
                  label={contaLabel}
                  className="rounded-full hover:bg-slate-100"
                >
                  <UserRound className="h-4.5 w-4.5" strokeWidth={1.75} />
                </IconLink>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
