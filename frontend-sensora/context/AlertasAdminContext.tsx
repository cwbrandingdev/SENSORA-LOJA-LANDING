"use client";

// Alertas do painel (GET /alertas) compartilhados pelo sininho do Header e
// pelos números da Sidebar: uma busca só, repetida a cada 30 s enquanto o
// painel está aberto (e assim que a aba volta a ficar visível). Quando um
// contador sobe, avisa com um toast e, com a aba em segundo plano, com uma
// notificação do navegador (se a pessoa permitiu). Só ADMIN: o backend
// responde 403 ao VENDEDOR, então para ele a lista fica vazia.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/errors";
import { PerfilUsuario, type Alerta, type AlertaTipo } from "@/lib/types/loja";
import { buscarAlertas, excluirAlerta as excluirAlertaApi } from "@/services/alertas";

const INTERVALO_MS = 30_000;

// Eventos que merecem aviso na hora quando aumentam. Estoque baixo fica só
// no contador: mudaria a cada venda e viraria barulho.
const AVISO: Partial<Record<AlertaTipo, (novos: number) => string>> = {
  PEDIDO_NOVO: (n) => (n === 1 ? "Novo pedido pago" : `${n} novos pedidos pagos`),
  SUPORTE_ABERTO: (n) => (n === 1 ? "Novo chamado de suporte" : `${n} novos chamados de suporte`),
  DEVOLUCAO_SOLICITADA: (n) => (n === 1 ? "Nova devolução solicitada" : `${n} novas devoluções solicitadas`),
  REEMBOLSO_SOLICITADO: (n) => (n === 1 ? "Novo reembolso solicitado" : `${n} novos reembolsos solicitados`),
  AVALIACAO_PENDENTE: (n) => (n === 1 ? "Nova avaliação para aprovar" : `${n} novas avaliações para aprovar`),
  MELHOR_ENVIO_DESCONECTADO: () => "Melhor Envio desconectado — frete indisponível",
};

type AlertasAdmin = {
  alertas: Alerta[];
  /** Hora da última consulta que deu certo (null antes da primeira). */
  atualizadoEm: Date | null;
  /** Erro da última tentativa de carregar (null se ok ou ainda não tentou). */
  erroCarregar: string | null;
  /** Soma dos alertas cujo link leva a esta página do painel. */
  quantidadeEm: (href: string) => number;
  recarregar: () => Promise<void>;
  /** Remove o alerta da lista deste admin até a pendência operacional sumir. */
  excluirAlerta: (tipo: AlertaTipo) => Promise<void>;
};

const AlertasAdminContext = createContext<AlertasAdmin>({
  alertas: [],
  atualizadoEm: null,
  erroCarregar: null,
  quantidadeEm: () => 0,
  recarregar: async () => {},
  excluirAlerta: async () => {},
});

export function AlertasAdminProvider({ children }: { children: ReactNode }) {
  const { perfil } = useAuth();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  // null = ainda não carregou: o que já estava pendente ao abrir o painel
  // não vira aviso, só o que chegar depois.
  const anteriores = useRef<Map<AlertaTipo, number> | null>(null);

  const atualizar = useCallback(async () => {
    if (perfil !== PerfilUsuario.ADMIN) return;
    try {
      const lista = await buscarAlertas();
      const antes = anteriores.current;
      anteriores.current = new Map(lista.map((alerta) => [alerta.tipo, alerta.quantidade]));
      if (antes) {
        for (const alerta of lista) {
          const novos = alerta.quantidade - (antes.get(alerta.tipo) ?? 0);
          const mensagem = AVISO[alerta.tipo];
          if (novos <= 0 || !mensagem) continue;
          toast.info(mensagem(novos));
          if (document.hidden && "Notification" in window && Notification.permission === "granted") {
            new Notification("Sensora — painel", { body: mensagem(novos) });
          }
        }
      }
      setAlertas(lista);
      setAtualizadoEm(new Date());
      setErroCarregar(null);
    } catch (err) {
      setErroCarregar(getErrorMessage(err, "Não foi possível carregar os alertas."));
    }
  }, [perfil]);

  useEffect(() => {
    if (!perfil) return undefined;

    if (perfil !== PerfilUsuario.ADMIN) {
      let ativo = true;
      (async () => {
        try {
          await buscarAlertas();
          if (!ativo) return;
          setAlertas([]);
          setErroCarregar(null);
        } catch (err) {
          if (!ativo) return;
          setErroCarregar(getErrorMessage(err, "Não foi possível carregar os alertas."));
        } finally {
          if (ativo) setAtualizadoEm(new Date());
        }
      })();
      return () => {
        ativo = false;
      };
    }

    let ativo = true;

    async function poll() {
      if (!ativo) return;
      await atualizar();
    }

    function aoVoltarParaAba() {
      if (!document.hidden) poll();
    }

    poll();
    const timer = window.setInterval(poll, INTERVALO_MS);
    document.addEventListener("visibilitychange", aoVoltarParaAba);
    return () => {
      ativo = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltarParaAba);
    };
  }, [perfil, atualizar]);

  const excluirAlerta = useCallback(
    async (tipo: AlertaTipo) => {
      await excluirAlertaApi(tipo);
      setAlertas((lista) => lista.filter((alerta) => alerta.tipo !== tipo));
    },
    [],
  );

  function quantidadeEm(href: string) {
    return alertas
      .filter((alerta) => alerta.link.split("?")[0] === href)
      .reduce((soma, alerta) => soma + alerta.quantidade, 0);
  }

  return (
    <AlertasAdminContext.Provider
      value={{ alertas, atualizadoEm, erroCarregar, quantidadeEm, recarregar: atualizar, excluirAlerta }}
    >
      {children}
    </AlertasAdminContext.Provider>
  );
}

export function useAlertasAdmin() {
  return useContext(AlertasAdminContext);
}
