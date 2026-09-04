"use client";

// Portado de frontend/components/layout/ProtectedLayout.js, com a proteção
// estendida na Etapa 10 (Task 2 / achado C2 da auditoria): antes só checava
// isAuthenticated, o que deixava qualquer CLIENTE logado ver o shell inteiro
// do Admin. Agora é o único ponto de guarda de toda a árvore /workspace-x/*
// (Etapa 8.12 — antes /admin/*) — só
// ADMIN/VENDEDOR (STAFF_ROLES) passam; CLIENTE vai para a loja. O backend
// (RolesGuard) continua sendo a autoridade real; isto é defesa em
// profundidade na camada visual.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/lib/routes";
import { STAFF_ROLES } from "@/lib/types/loja";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, loading, perfil } = useAuth();
  const autorizado = isAuthenticated && perfil !== null && STAFF_ROLES.includes(perfil);
  // Etapa 6.6 (Dashboard Admin) — único ponto de verdade sobre a gaveta
  // mobile da Sidebar: Header dispara a abertura (botão hambúrguer),
  // Sidebar decide quando fechar (overlay, Escape, troca de rota).
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push(ROUTES.LOGIN);
    } else if (!autorizado) {
      router.push(ROUTES.LOJA);
    }
  }, [loading, isAuthenticated, autorizado, router]);

  if (loading) {
    return (
      <p className="flex min-h-screen flex-1 items-center justify-center text-sm text-slate-500">
        Carregando...
      </p>
    );
  }

  if (!autorizado) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Header onMenuClick={() => setMobileMenuOpen(true)} />
      <div className="flex flex-1">
        <Sidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <main className="min-w-0 flex-1 bg-background p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
