"use client";

// Etapa 6.5 (Painel administrativo) — card de integração dentro do
// Dashboard do admin (STAFF_ROLES já protege toda a árvore /workspace-x/*
// — Etapa 8.12, antes /admin/* — ver ProtectedLayout — nenhuma checagem de
// perfil extra é necessária aqui).
// Este componente só orquestra os endpoints do backend, que permanecem em
// /admin/... (Etapa 8.12 só renomeou a rota do frontend, nunca os
// endpoints HTTP — ver lib/routes.ts): GET /admin/melhor-envio/status,
// GET /admin/melhor-envio/verificar e GET /admin/melhor-envio/conectar — a
// conexão em si (OAuth, troca de código por token, persistência) é
// inteiramente responsabilidade do backend, já validada.
//
// Vistoria das Integrações — `status.configured` (credenciais OAuth2
// presentes) e `status.conectado` (token já salvo) agora vêm separados do
// backend (antes só existia `conectado`). "Verificar agora" (antes
// "Verificar conexão", que só reconsultava /status) passou a chamar
// GET /admin/melhor-envio/verificar — uma leitura real contra a API do
// Melhor Envio (GET /api/v2/me), não só a existência do token no banco.
// `ambiente`/`expiresAt` são exibidos porque não são secretos (nunca o
// token em si).
import { useCallback, useEffect, useState } from "react";
import FormButton from "@/components/ui/FormButton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import type { MelhorEnvioStatusResponse } from "@/lib/types/loja";
import {
  buscarStatusMelhorEnvio,
  obterUrlConexaoMelhorEnvio,
  verificarMelhorEnvio,
} from "@/services/melhor-envio";

// Mesmo raciocínio de isUrlDeCheckoutSegura (services/checkout.ts): o
// backend é a fonte da URL, mas a UI nunca navega para uma string arbitrária
// vinda da resposta sem checar minimamente o esquema.
function isUrlSegura(valor: unknown): valor is string {
  if (typeof valor !== "string" || valor.length === 0) return false;
  try {
    return new URL(valor).protocol === "https:";
  } catch {
    return false;
  }
}

export default function MelhorEnvioIntegracaoCard() {
  const toast = useToast();
  const [status, setStatus] = useState<MelhorEnvioStatusResponse | null>(null);
  const [carregandoStatus, setCarregandoStatus] = useState(true);
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [operational, setOperational] = useState<boolean | null>(null);
  const [mensagemOperacional, setMensagemOperacional] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  const carregarStatus = useCallback(async () => {
    setCarregandoStatus(true);
    setErroStatus(null);
    // Um novo status torna a última verificação ao vivo obsoleta — mesmo
    // raciocínio de IntegracaoStatusCard.tsx.
    setOperational(null);
    setMensagemOperacional(null);
    try {
      const resposta = await buscarStatusMelhorEnvio();
      setStatus(resposta);
    } catch (err) {
      setErroStatus(getErrorMessage(err, "Não foi possível verificar a conexão."));
    } finally {
      setCarregandoStatus(false);
    }
  }, []);

  useEffect(() => {
    carregarStatus();
  }, [carregarStatus]);

  async function handleConectar() {
    if (conectando) return;
    setConectando(true);
    try {
      const resposta = await obterUrlConexaoMelhorEnvio();
      if (!isUrlSegura(resposta.url)) {
        toast.error("Não foi possível iniciar a conexão. Tente novamente.");
        setConectando(false);
        return;
      }
      // Redireciona para a própria página de autorização do Melhor Envio —
      // nunca a URL da API da Sensora. `conectando` deliberadamente não
      // volta a `false`: o navegador já está saindo desta página.
      window.location.assign(resposta.url);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível iniciar a conexão com o Melhor Envio."));
      setConectando(false);
    }
  }

  async function handleVerificar() {
    if (verificando) return;
    setVerificando(true);
    setMensagemOperacional(null);
    try {
      const resposta = await verificarMelhorEnvio();
      setOperational(resposta.operational);
      setMensagemOperacional(resposta.mensagem ?? null);
    } catch (err) {
      setOperational(false);
      setMensagemOperacional(getErrorMessage(err, "Não foi possível verificar agora."));
    } finally {
      setVerificando(false);
    }
  }

  const configurado = status?.configured ?? false;
  const conectado = status?.conectado ?? false;

  let corBadge = "text-slate-500";
  let corDot = "bg-slate-400";
  let textoBadge = "Não configurado";
  if (configurado && !conectado) {
    textoBadge = "Não conectado";
  } else if (conectado) {
    if (operational === true) {
      corBadge = "text-emerald-600";
      corDot = "bg-emerald-500";
      textoBadge = "Operacional";
    } else if (operational === false) {
      corBadge = "text-amber-600";
      corDot = "bg-amber-500";
      textoBadge = "Instável";
    } else {
      corBadge = "text-emerald-600";
      corDot = "bg-emerald-500";
      textoBadge = "Conectado";
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-brand-navy">Melhor Envio</h3>

        {carregandoStatus ? (
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Verificando...
          </span>
        ) : erroStatus ? (
          <span className="text-xs font-medium uppercase tracking-wide text-red-600">
            Erro ao verificar
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${corBadge}`}
          >
            <span aria-hidden className={`h-2 w-2 rounded-full ${corDot}`} />
            {textoBadge}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-500">
        {!configurado
          ? "Credenciais OAuth2 do Melhor Envio (ID e chave do cliente, URL de redirecionamento) não configuradas neste ambiente."
          : !conectado
            ? "Conecte a conta Sandbox/Produção do Melhor Envio para habilitar a cotação de frete no checkout."
            : "A loja está conectada ao Melhor Envio e pronta para cotar frete no checkout."}
      </p>

      {!erroStatus && !carregandoStatus && configurado && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-slate-400">
            Ambiente:{" "}
            <span className="font-mono">
              {status?.ambiente === "production" ? "Produção" : "Sandbox"}
            </span>
          </p>
          {conectado && status?.expiresAt && (
            <p className="text-xs text-slate-400">
              Token válido até{" "}
              <span className="font-mono">
                {new Date(status.expiresAt).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              </span>
            </p>
          )}
        </div>
      )}

      {erroStatus && <InlineErrorState message={erroStatus} onRetry={carregarStatus} />}

      {!erroStatus && !carregandoStatus && (
        <div className="flex flex-col gap-2">
          <div>
            {conectado ? (
              <FormButton variant="secondary" onClick={handleVerificar} disabled={verificando}>
                {verificando ? "Verificando..." : "Verificar agora"}
              </FormButton>
            ) : (
              <FormButton
                variant="primary"
                onClick={handleConectar}
                disabled={conectando || !configurado}
              >
                {conectando ? "Conectando..." : "Conectar Melhor Envio"}
              </FormButton>
            )}
          </div>
          {mensagemOperacional && (
            <p className={`text-xs ${operational ? "text-emerald-600" : "text-amber-600"}`}>
              {mensagemOperacional}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
