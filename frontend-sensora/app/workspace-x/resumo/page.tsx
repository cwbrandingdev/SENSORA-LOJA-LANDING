"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/lib/routes";
import { PerfilUsuario } from "@/lib/types/loja";
import ResumoMensalPainel from "@/components/admin/ResumoMensalPainel";

export default function ResumoMensalPage() {
  const router = useRouter();
  const { perfil, loading } = useAuth();
  const autorizado = perfil === PerfilUsuario.ADMIN;

  useEffect(() => {
    if (loading) return;
    if (!autorizado) {
      router.push(ROUTES.DASHBOARD);
    }
  }, [loading, autorizado, router]);

  if (loading || !autorizado) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-brand-navy">Resumo mensal</h2>
        <p className="text-sm text-slate-600">
          Faturamento, pedidos e comparativo entre meses (calendário de São Paulo).
        </p>
      </div>

      <ResumoMensalPainel />
    </div>
  );
}
