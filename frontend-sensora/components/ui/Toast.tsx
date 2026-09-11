"use client";

// Etapa (Modernização de Toasts) — encapsula o Toaster do Sonner (biblioteca
// adotada após a vistoria que comparou com a referência do 21st.dev/shadcn:
// https://21st.dev/community/components/shadcn/sonner). Este é o ÚNICO
// arquivo do projeto que importa algo de "sonner" para renderização — o
// resto da aplicação nunca importa Sonner diretamente, só usa useToast()
// (ver context/ToastContext.tsx), preservando o "componente próprio" que já
// existia aqui antes desta etapa (era ToastViewport, 100% caseiro).
//
// richColors habilitado, mas com a paleta REDEFINIDA abaixo (via CSS custom
// properties, mecanismo de tema oficial do Sonner) para os mesmos tons
// pastel de verde/vermelho já usados no projeto antes desta etapa — ver o
// antigo TOAST_STYLES deste arquivo (bg-green-50/text-green-700,
// bg-red-50/text-red-700) e .authswitch-alert.success em
// components/auth/AuthSwitch.tsx (mesmos hex). Nunca a cor de marca
// (laranja) e nunca um bloco saturado: só o suficiente para sucesso/erro
// continuarem semanticamente claros à primeira vista, sem exagero (pedido
// explícito). --normal-*: o toast neutro (usado, por exemplo, pelo estado
// "loading" de um futuro toast.promise) reaproveita o navy da marca no
// texto e uma borda com leve tom de navy — o único toque de identidade
// Sensora fora do verde/vermelho semântico, para não parecer um componente
// genérico só colado no projeto.
import type { CSSProperties } from "react";
import { Toaster } from "sonner";

const SENSORA_TOAST_THEME = {
  fontFamily: "var(--font-inter), Arial, Helvetica, sans-serif",
  "--border-radius": "12px",
  "--normal-bg": "#ffffff",
  "--normal-border": "rgba(2, 24, 61, 0.12)",
  "--normal-text": "var(--brand-navy)",
  "--success-bg": "#f0fdf4",
  "--success-border": "#bbf7d0",
  "--success-text": "#15803d",
  "--error-bg": "#fef2f2",
  "--error-border": "#fecaca",
  "--error-text": "#b91c1c",
} as CSSProperties;

export default function SensoraToaster() {
  return (
    <Toaster
      position="bottom-right"
      duration={4000}
      closeButton
      richColors
      style={SENSORA_TOAST_THEME}
      toastOptions={{
        closeButtonAriaLabel: "Fechar notificação",
        // Cantos arredondados + sombra discreta já vêm do próprio Sonner
        // (var(--border-radius) acima e o box-shadow padrão dele) — não
        // sobrescritos aqui de propósito, para não pesar o visual.
      }}
    />
  );
}
