"use client";

// Sininho do Header: total do que está pendente e, ao clicar, a lista dos
// alertas (mesmos dados do quadro do Dashboard), cada um levando à página
// certa. Também oferece ativar as notificações do navegador.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAlertasAdmin } from "@/context/AlertasAdminContext";
import { cn } from "@/lib/utils";

const COR_SEVERIDADE = {
  info: "bg-sky-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
} as const;

export default function SinoAlertas() {
  const { alertas, atualizadoEm } = useAlertasAdmin();
  const [aberto, setAberto] = useState(false);
  const [permissao, setPermissao] = useState<
    NotificationPermission | "indisponivel"
  >("indisponivel");
  const raiz = useRef<HTMLDivElement>(null);
  const total = alertas.reduce((soma, alerta) => soma + alerta.quantidade, 0);

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

  async function ativarNotificacoes() {
    setPermissao(await Notification.requestPermission());
  }

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => {
          // Lida a cada abertura: a permissão pode ter mudado nas configurações do navegador.
          setPermissao(
            "Notification" in window ? Notification.permission : "indisponivel",
          );
          setAberto((valor) => !valor);
        }}
        aria-expanded={aberto}
        aria-label={
          total > 0 ? `Alertas: ${total} pendentes` : "Alertas: nada pendente"
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/10"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-semibold text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {aberto && (
        <div className="fixed inset-x-4 top-16 z-50 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 rounded-lg bg-white text-slate-800 shadow-xl ring-1 ring-black/5">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-brand-navy">
            Pendências
          </p>
          {alertas.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Nada pendente no momento.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {alertas.map((alerta) => (
                <li key={alerta.tipo}>
                  <Link
                    href={alerta.link}
                    onClick={() => setAberto(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        COR_SEVERIDADE[alerta.severidade],
                      )}
                    />
                    <span className="min-w-0 flex-1">{alerta.titulo}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-brand-navy">
                      {alerta.quantidade}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {permissao === "default" && (
            <button
              type="button"
              onClick={ativarNotificacoes}
              className="w-full border-t border-slate-100 px-4 py-3 text-left text-xs font-medium text-brand-orange hover:bg-slate-50"
            >
              Ativar avisos do navegador (mesmo com a aba em segundo plano)
            </button>
          )}
          {permissao === "denied" && (
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              Avisos do navegador bloqueados. Para ativar, libere as
              notificações deste site nas configurações do navegador.
            </p>
          )}
          {atualizadoEm && (
            <p className="border-t border-slate-100 px-4 py-2 text-right text-[11px] text-slate-400">
              Atualizado às{" "}
              {atualizadoEm.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
