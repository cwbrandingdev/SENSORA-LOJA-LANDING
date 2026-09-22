"use client";

// Mesma transição do login: o AuthSwitch começa já no modo "Criar conta".
// CPF e o aceite dos termos ficam nesse formulário, não numa página separada.
import { Suspense } from "react";
import AuthSwitch from "@/components/auth/AuthSwitch";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <AuthSwitch initialMode="register" />
    </Suspense>
  );
}
