"use client";

// Mesmo padrão arquitetural de context/AuthContext.tsx — createContext +
// Provider + hook. Fachada de compatibilidade (Etapa — Modernização de
// Toasts): por baixo, `success`/`error` agora delegam para o Sonner (ver
// components/ui/Toast.tsx), mas a API pública (`useToast()`,
// `toast.success(message)`, `toast.error(message)`) é exatamente a mesma de
// antes — nenhum dos ~17 pontos de chamada existentes precisou mudar.
// `ToastContext`/`ToastProvider`/`useToast()` continuam existindo (mesmos
// nomes/exports) de propósito, mesmo o Sonner já sendo, por si só, um
// singleton global que não precisaria de Context: manter o Context preserva
// o comportamento de sempre lançar erro claro (`useToast deve ser usado
// dentro de um ToastProvider`) quando alguém usa o hook fora de uma árvore
// que montou o Toaster — sem isso, um Toaster esquecido falharia em
// silêncio (toast nunca aparece), em vez de um erro alto e óbvio em dev.
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { toast as sonnerToast } from "sonner";
import SensoraToaster from "@/components/ui/Toast";

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  // Etapa (Modernização de Toasts) — suporte preparado para uso futuro,
  // mesma assinatura genérica do toast.promise nativo do Sonner (loading ->
  // success/error automático, mensagem de sucesso podendo ser função do
  // resultado — ver referência 21st.dev/shadcn Sonner:
  // https://21st.dev/community/components/shadcn/sonner). Nenhum fluxo
  // existente foi migrado para usar isto nesta etapa — só
  // toast.success/toast.error continuam em uso.
  promise: typeof sonnerToast.promise;
};

// Objeto estável (fora do componente): Sonner já é um singleton global por
// si só (o próprio módulo mantém o estado dos toasts, não precisa de
// useState/useCallback aqui como a implementação caseira anterior exigia) —
// recriar este objeto a cada render não traria nenhum benefício.
const toastApi: ToastApi = {
  success: (message) => {
    sonnerToast.success(message);
  },
  error: (message) => {
    sonnerToast.error(message);
  },
  promise: sonnerToast.promise,
};

const ToastContext = createContext<ToastApi | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      <SensoraToaster />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast deve ser usado dentro de um ToastProvider");
  }
  return context;
}
