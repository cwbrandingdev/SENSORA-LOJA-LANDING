"use client";

// Portado de frontend/components/layout/Header.js — reaproveita o Logo.tsx
// canônico da Landing (public/logo.png) em vez de duplicar o asset.
// Etapa 6.6 (Dashboard Admin) — passou a mostrar o usuário real (e-mail +
// perfil, via AuthContext — sem chamada de API nova: o JWT não carrega
// `nome`, só e-mail/perfil/sub, já decodificados em sincronizarComToken) no
// lugar do texto genérico "Usuário autenticado.". Também ganhou o botão de
// menu (hambúrguer), visível só em mobile (`md:hidden`), que abre a Sidebar
// como gaveta — a própria Sidebar decide como se comporta com `open`.
import Logo from "@/components/ui/Logo";
import { useAuth } from "@/context/AuthContext";
import { PerfilUsuario } from "@/lib/types/loja";

const PERFIL_LABEL: Record<PerfilUsuario, string> = {
  [PerfilUsuario.ADMIN]: "Administrador",
  [PerfilUsuario.VENDEDOR]: "Vendedor",
  [PerfilUsuario.CLIENTE]: "Cliente",
};

type HeaderProps = {
  onMenuClick?: () => void;
};

export default function Header({ onMenuClick }: HeaderProps) {
  const { email, perfil } = useAuth();

  return (
    <header className="flex items-center justify-between bg-brand-navy px-4 py-3 text-white sm:px-6">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Abrir menu de navegação"
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/10 md:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <Logo showTagline={false} className="scale-75" />
      </div>

      <div className="flex flex-col items-end leading-tight">
        <p className="max-w-[40vw] truncate text-sm text-white/90 sm:max-w-none">
          {email ?? "Usuário autenticado."}
        </p>
        {perfil && (
          <p className="text-xs uppercase tracking-[0.14em] text-brand-orange-light">
            {PERFIL_LABEL[perfil]}
          </p>
        )}
      </div>
    </header>
  );
}
