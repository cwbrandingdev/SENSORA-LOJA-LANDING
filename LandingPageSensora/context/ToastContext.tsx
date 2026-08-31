"use client";

// Mesmo padrão arquitetural de context/AuthContext.tsx — createContext +
// Provider + hook. Toast se autodestrói via setTimeout, sem exigir clique;
// o botão de fechar é só um atalho opcional, não o mecanismo principal.
import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import ToastViewport, { type ToastItem } from "@/components/ui/Toast";

const TOAST_DURATION_MS = 4000;

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastItem["type"], message: string) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const toast: ToastApi = {
    success: (message: string) => show("success", message),
    error: (message: string) => show("error", message),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
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
