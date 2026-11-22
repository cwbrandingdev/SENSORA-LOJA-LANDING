"use client";

// Microsoft Clarity: mapa de calor e gravação das sessões dos visitantes.
// Igual ao Google Analytics, só carrega depois que o visitante aceita os
// cookies de análise no banner (LGPD). Se ele retirar o consentimento, o
// Clarity para de gravar e apaga os cookies dele.
import { useEffect } from "react";
import { COOKIE_CONSENT_CHANGED_EVENT, hasConsentFor } from "@/lib/cookieConsent";

// ID do projeto no painel do Clarity (clarity.microsoft.com). Não é segredo:
// ele aparece no código de qualquer site que usa o Clarity.
const CLARITY_PROJECT_ID = "zb0usl2rxp";

type Clarity = ((...args: unknown[]) => void) & { q?: unknown[][] };

declare global {
  interface Window {
    clarity?: Clarity;
  }
}

// O mesmo snippet oficial do Clarity, escrito de forma legível: cria uma
// fila de comandos e baixa o script, que depois processa essa fila.
function carregarClarity() {
  if (window.clarity) return;

  const clarity: Clarity = (...args) => {
    clarity.q = clarity.q ?? [];
    clarity.q.push(args);
  };
  window.clarity = clarity;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  document.head.appendChild(script);
}

export default function ClarityScript() {
  useEffect(() => {
    // Em desenvolvimento não grava, para não misturar testes com visitas reais.
    if (process.env.NODE_ENV !== "production") return;

    function sincronizarComConsentimento() {
      if (hasConsentFor("analytics")) {
        carregarClarity();
        window.clarity?.("consent");
      } else {
        window.clarity?.("consent", false);
      }
    }

    sincronizarComConsentimento();
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, sincronizarComConsentimento);
    return () =>
      window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, sincronizarComConsentimento);
  }, []);

  return null;
}
