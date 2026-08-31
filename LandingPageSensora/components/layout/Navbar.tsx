"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/ui/Logo";
import { NAV_CATEGORIES } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { loginComRedirect } from "@/lib/auth-redirect";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { PerfilUsuario, STAFF_ROLES } from "@/lib/types/loja";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { totalItens } = useCart();
  const pathname = usePathname();
  const { isAuthenticated, loading, perfil, logout } = useAuth();

  // Task 22 (Navbar/login) — mesmo destino que o próprio /login já usa após
  // autenticar (ver app/login/page.tsx): CLIENTE vai para a loja, ADMIN/
  // VENDEDOR para o painel. loginComRedirect é o mesmo helper que /login já
  // valida do outro lado (isDestinoInternoValido) — nenhuma lógica de
  // redirect nova foi inventada aqui.
  let contaLabel = "Entrar";
  let contaHref: string = loginComRedirect(pathname ?? "/");
  if (isAuthenticated) {
    if (perfil === PerfilUsuario.CLIENTE) {
      contaLabel = "Minha conta";
      contaHref = ROUTES.LOJA;
    } else if (perfil !== null && STAFF_ROLES.includes(perfil)) {
      contaLabel = "Painel administrativo";
      contaHref = ROUTES.DASHBOARD;
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-brand-navy text-white">
      {/* Mobile: logo + hamburger em uma única linha */}
      <div className="flex items-center justify-between px-4 py-4 md:hidden">
        <div><Link href="/" aria-label="Sensora, ir para o início">
          <Logo className="scale-90" />
        </Link>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          className="flex h-9 w-9 flex-col items-center justify-center gap-1.5"
        >
          <span
            className={`h-0.5 w-6 bg-white transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`h-0.5 w-6 bg-white transition-opacity ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`h-0.5 w-6 bg-white transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Desktop: logo à esquerda, navegação à direita, em uma única linha */}
      <div className="mx-auto hidden max-w-7xl items-center justify-between px-6 py-4 md:flex lg:px-10">
        <Link href="/" aria-label="Sensora, ir para o início">
          <Logo showTagline={false} className="scale-90" />
        </Link>
        <nav aria-label="Categorias de produtos">
          <ul className="flex items-center gap-9">
            {NAV_CATEGORIES.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="group relative inline-block text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 hover:text-brand-orange"
                >
                  {item.label}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                  />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={ROUTES.LOJA_CARRINHO}
                className="group relative inline-flex items-center gap-1.5 text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 hover:text-brand-orange"
              >
                Carrinho
                {totalItens > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-orange px-1 text-[11px] font-semibold text-white">
                    {totalItens}
                  </span>
                )}
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                />
              </Link>
            </li>
            {!loading && (
              <>
                <li>
                  <Link
                    href={contaHref}
                    className="group relative inline-block text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 hover:text-brand-orange"
                  >
                    {contaLabel}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                    />
                  </Link>
                </li>
                {isAuthenticated && (
                  <li>
                    <button
                      type="button"
                      onClick={logout}
                      className="group relative inline-block text-sm font-medium tracking-wide text-white/90 transition-colors duration-300 hover:text-brand-orange"
                    >
                      Sair
                      <span
                        aria-hidden
                        className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                      />
                    </button>
                  </li>
                )}
              </>
            )}
          </ul>
        </nav>
      </div>

      {/* Mobile: menu suspenso */}
      <nav
        aria-label="Categorias de produtos"
        className={`overflow-hidden transition-[max-height] duration-300 md:hidden ${open ? "max-h-96" : "max-h-0"}`}
      >
        <ul className="flex flex-col gap-1 px-6 pb-4">
          {NAV_CATEGORIES.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-2 py-3 text-sm font-medium tracking-wide text-white/90 hover:bg-white/10 hover:text-brand-orange"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={ROUTES.LOJA_CARRINHO}
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 rounded-md px-2 py-3 text-sm font-medium tracking-wide text-white/90 hover:bg-white/10 hover:text-brand-orange"
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
                  className="block rounded-md px-2 py-3 text-sm font-medium tracking-wide text-white/90 hover:bg-white/10 hover:text-brand-orange"
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
                    className="block w-full rounded-md px-2 py-3 text-left text-sm font-medium tracking-wide text-white/90 hover:bg-white/10 hover:text-brand-orange"
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
