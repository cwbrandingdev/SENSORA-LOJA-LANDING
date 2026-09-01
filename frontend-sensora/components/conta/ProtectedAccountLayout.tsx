"use client";

// Guarda de acesso da área "Minha Conta" — mesmo padrão de
// components/admin/ProtectedLayout.tsx (useAuth + loading/isAuthenticated),
// mas sem a restrição STAFF_ROLES: qualquer usuário autenticado (CLIENTE,
// VENDEDOR ou ADMIN) acessa /conta normalmente. O backend (JwtStrategy)
// continua sendo a autoridade real sobre a sessão; isto é só a camada
// visual, igual ao Admin.
//
// Diferente do Admin (que sempre manda para ROUTES.LOGIN sem preservar
// destino), aqui o não-autenticado é redirecionado com
// loginComRedirect(pathname) — mesmo padrão já usado em
// services/api.ts (401) e app/(site)/loja/checkout/page.tsx, para voltar
// exatamente para /conta depois do login.
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { loginComRedirect } from "@/lib/auth-redirect";

export default function ProtectedAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push(loginComRedirect(pathname ?? "/conta"));
    }
  }, [loading, isAuthenticated, pathname, router]);

  if (loading || !isAuthenticated) {
    return (
      <p className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Carregando...
      </p>
    );
  }

  return <>{children}</>;
}
