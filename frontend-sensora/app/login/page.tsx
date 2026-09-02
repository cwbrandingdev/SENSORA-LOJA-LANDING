"use client";

// Etapa 6.2 (correção — Auth Switch) — esta página só monta o AuthSwitch já
// no modo "login". Toda a composição visual, animação e lógica de
// autenticação vivem em components/auth/AuthSwitch.tsx (compartilhado com
// app/register/page.tsx) — ver comentário no topo daquele arquivo sobre por
// que a troca Login⇄Cadastro é feita por estado local e não por navegação
// entre rotas.
import { Suspense } from "react";
import AuthSwitch from "@/components/auth/AuthSwitch";

export default function LoginPage() {
  return (
    // useSearchParams() (usado dentro do AuthSwitch para o ?redirect= do
    // login) exige um limite de Suspense no Next.js App Router.
    <Suspense fallback={null}>
      <AuthSwitch initialMode="login" />
    </Suspense>
  );
}
