"use client";

// Google Tag Manager: carrega as tags configuradas no painel do GTM
// (tagmanager.google.com). Igual ao Google Analytics e ao Clarity, só
// carrega depois que o visitante aceita os cookies de análise no banner
// (LGPD). Divide o `window.dataLayer` com o Google Analytics, que é o
// padrão do Google: os dois leem a mesma fila de eventos.
import { useEffect } from "react";
import { COOKIE_CONSENT_CHANGED_EVENT, hasConsentFor } from "@/lib/cookieConsent";

// ID do contêiner no painel do GTM. Não é segredo: aparece no código de
// qualquer site que usa o GTM.
const GTM_ID = "GTM-NV5SP5VG";
const GTM_SCRIPT_ID = "sensora-gtm-js";

// O snippet oficial do GTM, escrito de forma legível: avisa o dataLayer que
// o GTM começou (evento "gtm.js") e baixa o script do contêiner.
function carregarGtm() {
  if (document.getElementById(GTM_SCRIPT_ID)) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.id = GTM_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

export default function GoogleTagManager() {
  useEffect(() => {
    // Em desenvolvimento não carrega, para não misturar testes com visitas reais.
    if (process.env.NODE_ENV !== "production") return;

    function sincronizarComConsentimento() {
      if (hasConsentFor("analytics")) carregarGtm();
    }

    sincronizarComConsentimento();
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, sincronizarComConsentimento);
    return () =>
      window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, sincronizarComConsentimento);
  }, []);

  return null;
}
