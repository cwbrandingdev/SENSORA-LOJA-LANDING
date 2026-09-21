"use client";

// Aviso de cookies/armazenamento local — NÃO é um CMP: como hoje a Sensora
// só usa tecnologias essenciais (autenticação, carrinho, continuidade do
// checkout — ver Política de Cookies), não há categoria opcional para o
// usuário escolher. Por isso é só um aviso informativo e não-bloqueante
// (role="region", nunca role="dialog"/aria-modal — não trava foco nem
// impede interação com o resto da página), com um único botão de
// ciência/fechamento. Persistência isolada em lib/cookieConsent.ts (nunca
// TOKEN_KEY) — mesmo padrão SSR-safe de RevealOnScroll.tsx/TextReveal.tsx:
// `visible` começa `false` (idêntico no server e no primeiro paint do
// client), só passa a `true` depois de checar o localStorage no useEffect,
// então nunca há mismatch de hidratação nem flash indevido.
import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { getCookieConsent, setCookieConsentAcknowledged } from "@/lib/cookieConsent";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (getCookieConsent()) return;

    setVisible(true);
    // Próximo frame — garante que o navegador registre o estado inicial
    // (fora de tela/opacidade 0) antes de aplicar o estado final, para a
    // transição de entrada realmente rodar em vez de "pular" direto.
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function handleAcknowledge() {
    setCookieConsentAcknowledged();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className={`fixed inset-x-4 bottom-4 z-40 sm:inset-x-auto sm:left-4 sm:right-auto sm:max-w-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
        entered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-brand-navy/10">
        <p className="text-sm leading-relaxed text-slate-600">
          A Sensora usa cookies e armazenamento local essenciais para
          autenticação/sessão, carrinho de compras e continuidade do
          checkout.{" "}
          <Link
            href="/politica-de-cookies"
            className="group relative inline-block font-medium text-brand-navy transition-colors hover:text-brand-orange"
          >
            Saiba mais na Política de Cookies
            <span
              aria-hidden
              className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
            />
          </Link>
          .
        </p>

        <div className="flex justify-end">
          <Button variant="navy" onClick={handleAcknowledge}>
            Entendi
          </Button>
        </div>
      </div>
    </div>
  );
}
