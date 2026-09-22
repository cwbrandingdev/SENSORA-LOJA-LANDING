"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COOKIE_CONSENT_CHANGED_EVENT, hasConsentFor } from "@/lib/cookieConsent";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const GA_SCRIPT_ELEMENT_ID = "sensora-gtag-js";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __sensoraGaLoadPromise?: Promise<void>;
    __sensoraGaConfigured?: boolean;
  }
}

function gtagScriptSrc(): string | null {
  if (!GA_MEASUREMENT_ID) return null;
  return `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
}

function installGtagSnippet(): void {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // Snippet oficial: fila no dataLayer antes do gtag.js baixar.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
}

/** Enfileira config no dataLayer (padrão Google) — dispara page_view quando o js carregar. */
function queueGaConfig(): void {
  if (!GA_MEASUREMENT_ID || !window.gtag || window.__sensoraGaConfigured) return;

  const debugMode = process.env.NODE_ENV === "development";
  window.gtag("config", GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: true,
    ...(debugMode ? { debug_mode: true } : {}),
  });
  window.__sensoraGaConfigured = true;
}

function dedupeGtagScriptTags(keep: HTMLScriptElement): void {
  const src = gtagScriptSrc();
  if (!src) return;
  document.querySelectorAll(`script[src="${src}"]`).forEach((node) => {
    if (node !== keep) node.remove();
  });
}

function scriptAlreadyFetched(src: string): boolean {
  return performance.getEntriesByName(src).length > 0;
}

function loadGtagLibrary(): Promise<void> {
  const src = gtagScriptSrc();
  if (!src) return Promise.resolve();

  if (window.__sensoraGaLoadPromise) {
    return window.__sensoraGaLoadPromise;
  }

  window.__sensoraGaLoadPromise = new Promise((resolve, reject) => {
    installGtagSnippet();
    window.gtag?.("js", new Date());
    queueGaConfig();

    const finish = () => resolve();

    let script = document.getElementById(
      GA_SCRIPT_ELEMENT_ID,
    ) as HTMLScriptElement | null;

    if (!script) {
      script = document.querySelector(
        `script[src="${src}"]`,
      ) as HTMLScriptElement | null;
    }

    if (script) {
      script.id = GA_SCRIPT_ELEMENT_ID;
      dedupeGtagScriptTags(script);
      if (script.dataset.loaded === "1" || scriptAlreadyFetched(src)) {
        script.dataset.loaded = "1";
        finish();
        return;
      }
      script.addEventListener(
        "load",
        () => {
          script!.dataset.loaded = "1";
          finish();
        },
        { once: true },
      );
      script.addEventListener(
        "error",
        () => reject(new Error("Falha ao carregar GA")),
        { once: true },
      );
      return;
    }

    script = document.createElement("script");
    script.id = GA_SCRIPT_ELEMENT_ID;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script!.dataset.loaded = "1";
      dedupeGtagScriptTags(script!);
      finish();
    };
    script.onerror = () => {
      window.__sensoraGaLoadPromise = undefined;
      reject(new Error("Falha ao carregar GA"));
    };
    document.head.appendChild(script);
  });

  return window.__sensoraGaLoadPromise;
}

/** Navegação SPA (App Router) — page_view extra além do config inicial. */
function trackSpaPageView(pathname: string): void {
  if (!GA_MEASUREMENT_ID || !window.gtag || !window.__sensoraGaConfigured) return;

  window.gtag("event", "page_view", {
    page_path: pathname + window.location.search,
    page_location: window.location.href,
  });
}

function warnIfNoCollectInDev(): void {
  if (process.env.NODE_ENV !== "development") return;

  window.setTimeout(() => {
    const resources = performance.getEntriesByType("resource");
    const sent = resources.some(
      (entry) =>
        entry.name.includes("/g/collect") ||
        entry.name.includes("google-analytics.com") ||
        entry.name.includes("analytics.google.com"),
    );
    if (sent) {
      console.info("[Sensora GA] Hit de medição detectado (Network / Performance).");
      return;
    }

    console.warn(
      "[Sensora GA] Nenhum hit de medição detectado após 5s. Confira Network (filtro " +
        "'collect' ou 'google-analytics'), erros de CSP no Console e se o fluxo de dados " +
        "GA4 usa o mesmo ID do .env. Em localhost, use Relatórios → Tempo real ou Admin → DebugView.",
    );
  }, 5000);
}

/** Scripts de terceiros — carregados só após consentimento explícito (LGPD). */
export default function OptionalAnalyticsScripts() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const initialPathRef = useRef<string | null>(null);
  const warnedRef = useRef(false);

  useEffect(() => {
    function sync() {
      const ok = Boolean(GA_MEASUREMENT_ID) && hasConsentFor("analytics");
      setEnabled(ok);
      if (!ok) {
        setReady(false);
        window.__sensoraGaConfigured = false;
      }
    }
    sync();
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
    return () =>
      window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    loadGtagLibrary()
      .then(() => {
        if (cancelled) return;
        setReady(true);
        if (!warnedRef.current) {
          warnedRef.current = true;
          warnIfNoCollectInDev();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setReady(false);
        window.__sensoraGaLoadPromise = undefined;
        if (process.env.NODE_ENV === "development") {
          console.warn("[Sensora GA]", err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready) return;

    if (initialPathRef.current === null) {
      initialPathRef.current = pathname;
      return;
    }

    if (initialPathRef.current === pathname) return;
    trackSpaPageView(pathname);
    if (process.env.NODE_ENV === "development") {
      console.info("[Sensora GA] page_view (SPA):", pathname);
    }
  }, [enabled, ready, pathname]);

  return null;
}
