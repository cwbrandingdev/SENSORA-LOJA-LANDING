"use client";

// Etapa 6.2 (correção — Auth Switch) — mesma experiência integrada do
// Login, só que iniciando no modo "register". Quem acessa /register
// diretamente (link salvo, digitado, etc.) cai na mesma interface animada
// de app/login/page.tsx em vez de uma página visualmente desconectada.
// Lógica/campos de cadastro inalterados — ver components/auth/AuthSwitch.tsx.
import { Suspense } from "react";
import AuthSwitch from "@/components/auth/AuthSwitch";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <AuthSwitch initialMode="register" />
    </Suspense>
  );
}
