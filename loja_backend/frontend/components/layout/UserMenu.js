"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getToken } from "@/lib/storage";
import { decodeToken } from "@/lib/jwt";
import Badge from "@/components/ui/Badge";

const PERFIL_LABEL = {
  ADMIN: "Administrador",
  CLIENTE: "Cliente",
};

function readEmail() {
  if (typeof window === "undefined") return null;
  return decodeToken(getToken())?.email ?? null;
}

export default function UserMenu() {
  const { logout, perfil } = useAuth();
  const [email] = useState(readEmail);

  const initial = (email?.[0] ?? "U").toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:pr-3"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-semibold text-white">
            {initial}
          </span>
          <span className="hidden max-w-[10rem] truncate text-sm font-medium text-white sm:block">
            {email ?? "Usuário"}
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-56 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-700 shadow-lg outline-none transition-opacity duration-150 data-[state=closed]:opacity-0 data-[state=open]:opacity-100"
        >
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navy text-sm font-semibold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {email ?? "Usuário"}
              </p>
              {perfil && (
                <Badge
                  variant={perfil === "ADMIN" ? "info" : "neutral"}
                  className="mt-0.5"
                >
                  {PERFIL_LABEL[perfil] ?? perfil}
                </Badge>
              )}
            </div>
          </div>

          <DropdownMenu.Separator className="my-1.5 h-px bg-slate-100" />

          <DropdownMenu.Item
            onSelect={logout}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-red-600 outline-none transition-colors data-[highlighted]:bg-red-50"
          >
            <LogOut size={16} />
            Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
