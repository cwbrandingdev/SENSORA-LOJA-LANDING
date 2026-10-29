"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import Logo from "@/components/ui/Logo";
import NavbarSearch from "@/components/layout/NavbarSearch";
import { NAV_CATEGORIES } from "@/lib/content";
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
];

const DESKTOP_LINKS = [
  ...CATEGORY_LINKS,
  { label: "Ver tudo", href: ROUTES.LOJA_PRODUTOS },
  { label: "Corporativo", href: ROUTES.PARA_EMPRESAS },
];

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
  onClick?: (evento: MouseEvent<HTMLAnchorElement>) => void;
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

function CategoryNav({ isActive }: { isActive: (href: string) => boolean }) {
  return (
    <nav aria-label="Categorias de produtos">
      <ul className="flex items-center gap-3">
        {DESKTOP_LINKS.map((item) => {
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className={cn(
                  "flex w-24 flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors",
                  "text-brand-navy hover:bg-stone-100",
                  isActive(item.href) && "text-brand-orange",
                )}
              >
                <span className="text-[14px] font-semibold">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// O ícone de sacola abre a sacola lateral em vez de navegar; o href para
// /loja/carrinho fica como alternativa (nova aba, sem JavaScript).
function abrirSacolaNoClique(abrirSacola: () => void) {
  return (evento: MouseEvent<HTMLAnchorElement>) => {
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey) return;
    evento.preventDefault();
    abrirSacola();
  };
}

function UtilityCluster({
  cartLabel,
  totalItens,
  onAbrirSacola,
  loading,
  contaHref,
  contaLabel,
  className,
}: {
  cartLabel: string;
  totalItens: number;
  onAbrirSacola: (evento: MouseEvent<HTMLAnchorElement>) => void;
  loading: boolean;
  contaHref: string;
  contaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full bg-stone-100 p-1 ring-1 ring-stone-200/80",
        className,
      )}
    >
      <NavbarSearch variant="barra" />
      <IconLink
        href={ROUTES.LOJA_CARRINHO}
        label={cartLabel}
        badge={totalItens}
        onClick={onAbrirSacola}
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
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItens, abrirSacola } = useCart();
  const onAbrirSacola = abrirSacolaNoClique(abrirSacola);
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

  function toggleMenu() {
    setMenuOpen((value) => !value);
  }

  return (
    <>
      <header
        className={cn(
          "pointer-events-none fixed inset-x-0 top-[var(--faixa-cupom)] z-50 font-rounded",
          // Menu mobile aberto precisa ficar acima do CookieConsentBanner
          // (também z-50, renderizado depois no DOM — empataria e o banner
          // venceria). max-lg: mantém o desktop em z-50, sem qualquer mudança,
          // mesmo no caso extremo de menuOpen permanecer true após um resize.
          menuOpen && "max-lg:z-60",
        )}
      >
        <div className="pointer-events-auto lg:hidden">
          <div className="border-b border-stone-200/80 bg-background">
            <div className="grid h-[calc(var(--navbar-height)-1px)] grid-cols-3 items-center px-4">
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
                  onClick={onAbrirSacola}
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
              className="h-[calc(100dvh-var(--navbar-height)-var(--faixa-cupom))] overflow-y-auto bg-background px-6 py-8"
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
                <li>
                  <Link
                    href={ROUTES.PARA_EMPRESAS}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      mobileLinkClass,
                      isActive(ROUTES.PARA_EMPRESAS) && "text-brand-navy",
                    )}
                  >
                    Para empresas
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
                    {/* Suporte a um toque no celular. Visitante passa pelo
                        login e volta para cá; equipe atende pelo painel. */}
                    {!(perfil !== null && STAFF_ROLES.includes(perfil)) && (
                      <li>
                        <Link
                          href={ROUTES.CONTA_SUPORTE}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            mobileLinkClass,
                            isActive(ROUTES.CONTA_SUPORTE) && "text-brand-navy",
                          )}
                        >
                          Suporte
                        </Link>
                      </li>
                    )}
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

        <div className="pointer-events-auto hidden border-b border-stone-200/80 bg-white lg:block">
          <div className="mx-auto flex h-[calc(var(--navbar-height)-1px)] max-w-384 flex-col items-center justify-center px-8">
            <Link
              href="/"
              aria-label="Sensora, ir para o início"
              className="flex shrink-0 items-center"
            >
              <Logo
                variant="dark"
                showTagline={false}
                className="h-9"
                imageClassName="h-9 w-auto"
              />
            </Link>

            <div className="mt-1 flex items-center justify-center gap-4">
              <CategoryNav isActive={isActive} />
              <UtilityCluster
                cartLabel={cartLabel}
                totalItens={totalItens}
                onAbrirSacola={onAbrirSacola}
                loading={loading}
                contaHref={contaHref}
                contaLabel={contaLabel}
              />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
