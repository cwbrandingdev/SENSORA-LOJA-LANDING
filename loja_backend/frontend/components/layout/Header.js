"use client";

import { Menu } from "lucide-react";
import Logo from "@/components/ui/Logo";
import UserMenu from "./UserMenu";
import { useAdminUI } from "@/context/AdminUIContext";

export default function Header() {
  const { setMobileOpen } = useAdminUI();

  return (
    <header className="flex items-center justify-between gap-3 border-b border-black/10 bg-brand-navy px-4 py-3 text-white md:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="rounded-md p-2 text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:hidden"
        >
          <Menu size={20} />
        </button>
        <Logo className="h-9 w-auto md:h-10" />
        <h1 className="hidden truncate text-lg font-semibold sm:block">
          Sensora Loja
        </h1>
      </div>
      <UserMenu />
    </header>
  );
}
