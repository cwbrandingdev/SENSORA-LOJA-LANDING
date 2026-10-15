"use client";

// "Responder por e-mail" do detalhe do Suporte: abre a tela de escrever do
// serviço escolhido (Gmail, Outlook, Yahoo no navegador, ou o app de e-mail
// do computador) já com destinatário, assunto e a mensagem do cliente citada.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Mail } from "lucide-react";

// Endereços de "escrever e-mail" de cada serviço. A citação é cortada para a
// URL não passar do limite que os navegadores e os serviços aceitam.
const LIMITE_CITACAO = 1500;

type Servico = { nome: string; url: (para: string, assunto: string, corpo: string) => string };

const SERVICOS: Servico[] = [
  {
    nome: "Gmail",
    url: (para, assunto, corpo) =>
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(para)}&su=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`,
  },
  {
    nome: "Outlook / Hotmail",
    url: (para, assunto, corpo) =>
      `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(para)}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`,
  },
  {
    nome: "Yahoo Mail",
    url: (para, assunto, corpo) =>
      `https://compose.mail.yahoo.com/?to=${encodeURIComponent(para)}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`,
  },
  {
    nome: "App de e-mail do computador",
    url: (para, assunto, corpo) =>
      `mailto:${para}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`,
  },
];

type ResponderEmailProps = {
  email: string;
  nome: string;
  assunto: string;
  mensagem: string;
  /** Já formatada (ex.: "13/10/2026, 14:54"). */
  data: string;
};

export default function ResponderEmail({ email, nome, assunto, mensagem, data }: ResponderEmailProps) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return undefined;
    function aoClicarFora(evento: MouseEvent) {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const citacao =
    mensagem.length > LIMITE_CITACAO ? `${mensagem.slice(0, LIMITE_CITACAO)}…` : mensagem;
  const corpo = `Olá, ${nome}.\n\n\n\n---\nEm ${data}, ${nome} escreveu:\n${citacao
    .split("\n")
    .map((linha) => `> ${linha}`)
    .join("\n")}`;
  const assuntoResposta = `Re: ${assunto}`;

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        className="inline-flex items-center justify-center gap-2 rounded-md border border-brand-navy bg-white px-3 py-3 text-sm font-medium text-brand-navy transition-colors hover:bg-slate-50 sm:py-2"
      >
        <Mail className="h-4 w-4" aria-hidden />
        Responder por e-mail
        <ChevronDown className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Responder com</p>
          {SERVICOS.map((servico) => {
            const navegador = !servico.url("", "", "").startsWith("mailto:");
            return (
              <a
                key={servico.nome}
                role="menuitem"
                href={servico.url(email, assuntoResposta, corpo)}
                target={navegador ? "_blank" : undefined}
                rel={navegador ? "noopener noreferrer" : undefined}
                onClick={() => setAberto(false)}
                className="block px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-brand-navy"
              >
                {servico.nome}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
