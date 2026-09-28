"use client";

// Central de Integrações — ADMIN-only (nunca VENDEDOR), conforme a tarefa.
// ProtectedLayout (components/admin/ProtectedLayout.tsx) já garante
// isAuthenticated + STAFF_ROLES antes desta página renderizar — o guard
// abaixo é uma restrição ADICIONAL, só desta página, sem alterar
// ProtectedLayout nem as permissões das outras rotas de /workspace-x/*
// (Etapa 8.12, antes /admin/*). A
// proteção real continua sendo o backend: cada endpoint de status usado
// aqui já é ADMIN_ONLY_ROLES (ver asaas.controller.ts/mail.controller.ts/
// imagekit.controller.ts) — isto é só defesa em profundidade na camada
// visual, mesmo raciocínio do próprio ProtectedLayout.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/lib/routes";
import { PerfilUsuario } from "@/lib/types/loja";
import IntegracoesQuadro from "@/components/admin/IntegracoesQuadro";

export default function IntegracoesPage() {
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
        <h2 className="text-xl font-semibold text-brand-navy">Integrações</h2>
        <p className="text-sm text-slate-600">
          Gerencie e acompanhe as conexões dos serviços utilizados pela Sensora.
        </p>
      </div>

      <IntegracoesQuadro />
    </div>
  );
}
