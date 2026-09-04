"use client";

// Etapa 6.5 (Painel administrativo) — card de integração dentro do
// Dashboard do admin (STAFF_ROLES já protege toda a árvore /workspace-x/*
// — Etapa 8.12, antes /admin/* — ver ProtectedLayout — nenhuma checagem de
// perfil extra é necessária aqui).
// Este componente só orquestra os dois endpoints existentes do backend,
// que permanecem em /admin/... (Etapa 8.12 só renomeou a rota do
// frontend, nunca os endpoints HTTP — ver lib/routes.ts):
// (GET /admin/melhor-envio/status, GET /admin/melhor-envio/conectar) — a
// conexão em si (OAuth, troca de código por token, persistência) é
// inteiramente responsabilidade do backend, já validada.
import { useCallback, useEffect, useState } from "react";
import FormButton from "@/components/ui/FormButton";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { buscarStatusMelhorEnvio, obterUrlConexaoMelhorEnvio } from "@/services/melhor-envio";

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
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [carregandoStatus, setCarregandoStatus] = useState(true);
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);

  const carregarStatus = useCallback(async () => {
    setCarregandoStatus(true);
    setErroStatus(null);
    try {
      const resposta = await buscarStatusMelhorEnvio();
      setConectado(resposta.conectado);
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
            className={`inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${
              conectado ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${conectado ? "bg-emerald-500" : "bg-slate-400"}`}
            />
            {conectado ? "Conectado" : "Não conectado"}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-500">
        {conectado
          ? "A loja está conectada ao Melhor Envio e pronta para cotar frete no checkout."
          : "Conecte a conta Sandbox/Produção do Melhor Envio para habilitar a cotação de frete no checkout."}
      </p>

      {erroStatus && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{erroStatus}</span>
          <button
            type="button"
            onClick={carregarStatus}
            className="shrink-0 font-medium underline underline-offset-2 hover:text-red-800"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!erroStatus && !carregandoStatus && (
        <div>
          {conectado ? (
            <FormButton variant="secondary" onClick={carregarStatus} disabled={carregandoStatus}>
              Verificar conexão
            </FormButton>
          ) : (
            <FormButton variant="primary" onClick={handleConectar} disabled={conectando}>
              {conectando ? "Conectando..." : "Conectar Melhor Envio"}
            </FormButton>
          )}
        </div>
      )}
    </div>
  );
}
