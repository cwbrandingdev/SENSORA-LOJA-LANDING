"use client";

// Portado de frontend/components/layout/ProtectedLayout.js, com a proteção
// estendida na Etapa 10 (Task 2 / achado C2 da auditoria): antes só checava
// isAuthenticated, o que deixava qualquer CLIENTE logado ver o shell inteiro
// do Admin. Agora é o único ponto de guarda de toda a árvore /admin/* — só
// ADMIN/VENDEDOR (STAFF_ROLES) passam; CLIENTE vai para a loja. O backend
// (RolesGuard) continua sendo a autoridade real; isto é defesa em
// profundidade na camada visual.
import { useEffect } from "react";
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
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
