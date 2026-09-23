"use client";

// CMP enxuto (LGPD): essenciais sempre ativos; opcionais só com opt-in.
// Scripts de analytics/marketing não rodam antes do consentimento — ver
// OptionalAnalyticsScripts.tsx e lib/cookieConsent.ts.
import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import {
  acceptAllOptionalCookies,
  COOKIE_CONSENT_OPEN_EVENT,
  getCookieConsent,
  rejectOptionalCookies,
  saveCustomCookieConsent,
} from "@/lib/cookieConsent";
import { motion } from "framer-motion";

type Panel = "banner" | "preferences";

const secondaryBtn =
  "inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy transition-all duration-300 hover:border-brand-navy hover:bg-slate-50";

function CategoryToggle({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <div className="rounded-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <label htmlFor={id} className="text-sm font-medium text-brand-navy">
            {label}
          </label>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-brand-navy"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
        />
      </div>
    </div>
  );
}

export default function CookieConsentBanner() {
  const titleId = useId();
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [panel, setPanel] = useState<Panel>("banner");
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [showCookies, setShowCookies] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setShowCookies(true);
    }, 1000);
  }, []);

  const close = useCallback(() => {
    setEntered(false);
    window.setTimeout(() => setVisible(false), 300);
  }, []);

  const openPreferences = useCallback(() => {
    const existing = getCookieConsent();
    setAnalytics(existing?.categories.analytics ?? false);
    setMarketing(existing?.categories.marketing ?? false);
    setPanel("preferences");
    setVisible(true);
    requestAnimationFrame(() => setEntered(true));
  }, []);

  useEffect(() => {
    if (!getCookieConsent()) {
      setVisible(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
  }, []);

  useEffect(() => {
    function onOpenPreferences() {
      openPreferences();
    }
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, onOpenPreferences);
    return () =>
      window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, onOpenPreferences);
  }, [openPreferences]);

  function finishAndClose(save: () => void) {
    save();
    close();
  }

  if (!visible) return null;

  const isDialog = panel === "preferences";

  const transition = {
    duration: 0.8,
    delay: 0.5,
    ease: [0, 0.71, 0.2, 1.01],
  };

  return (
    <>
      {showCookies ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div
            className={`fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-end sm:justify-start sm:p-0 ${
              isDialog ? "bg-brand-navy/40" : "pointer-events-none"
            }`}
            role={isDialog ? "presentation" : undefined}
            onClick={
              isDialog
                ? (e) => e.target === e.currentTarget && close()
                : undefined
            }
          >
            <div
              role={isDialog ? "dialog" : "region"}
              aria-modal={isDialog ? true : undefined}
              aria-labelledby={isDialog ? titleId : undefined}
              aria-label={isDialog ? undefined : "Consentimento de cookies"}
              className={`pointer-events-auto flex max-h-[min(90vh,640px)] w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-brand-navy/10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:max-w-md ${
                isDialog
                  ? "sm:fixed sm:inset-x-4 sm:bottom-4 sm:left-4 sm:right-auto sm:top-auto"
                  : "fixed inset-x-4 bottom-4 sm:inset-x-auto sm:left-4 sm:right-auto sm:max-w-sm"
              } ${entered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
            >
              <div className="flex flex-col gap-4 overflow-y-auto p-5">
                {panel === "banner" ? (
                  <>
                    <p className="text-sm leading-relaxed text-slate-600">
                      Usamos cookies e armazenamento local{" "}
                      <strong>essenciais</strong> para login, carrinho e
                      checkout. Cookies <strong>opcionais</strong> (como medição
                      de audiência) só são usados se você consentir, conforme a
                      LGPD.{" "}
                      <Link
                        href="/politica-de-cookies"
                        className="group relative inline-block font-medium text-brand-navy transition-colors hover:text-brand-orange"
                      >
                        Política de Cookies
                        <span
                          aria-hidden
                          className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                        />
                      </Link>
                      .
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                      <button
                        type="button"
                        className={`${secondaryBtn} order-2 sm:order-1`}
                        onClick={() => finishAndClose(rejectOptionalCookies)}
                      >
                        Recusar opcionais
                      </button>
                      <button
                        type="button"
                        className={`${secondaryBtn} order-3 sm:order-2`}
                        onClick={() => {
                          openPreferences();
                        }}
                      >
                        Personalizar
                      </button>
                      <Button
                        variant="navy"
                        className="order-1 w-full sm:order-3 sm:w-auto"
                        onClick={() => finishAndClose(acceptAllOptionalCookies)}
                      >
                        Aceitar todos
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h2
                        id={titleId}
                        className="font-serif text-lg text-brand-navy sm:text-xl"
                      >
                        Preferências de cookies
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        Você pode alterar ou revogar seu consentimento a
                        qualquer momento. Recusar opcionais não impede o uso da
                        loja.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <CategoryToggle
                        id={`${titleId}-essential`}
                        label="Essenciais (sempre ativos)"
                        description="Autenticação, carrinho, continuidade do checkout e esta preferência."
                        checked
                        disabled
                      />
                      <CategoryToggle
                        id={`${titleId}-analytics`}
                        label="Analytics"
                        description="Medição anônima de visitas e desempenho do site (ex.: Google Analytics), se configurado."
                        checked={analytics}
                        onChange={setAnalytics}
                      />
                      <CategoryToggle
                        id={`${titleId}-marketing`}
                        label="Marketing"
                        description="Personalização de anúncios e remarketing, se no futuro utilizarmos essas ferramentas."
                        checked={marketing}
                        onChange={setMarketing}
                      />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      {getCookieConsent() ? (
                        <button
                          type="button"
                          className={secondaryBtn}
                          onClick={close}
                        >
                          Cancelar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={secondaryBtn}
                          onClick={() => setPanel("banner")}
                        >
                          Voltar
                        </button>
                      )}
                      <Button
                        variant="navy"
                        onClick={() =>
                          finishAndClose(() =>
                            saveCustomCookieConsent(analytics, marketing),
                          )
                        }
                      >
                        Salvar preferências
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </>
  );
}
