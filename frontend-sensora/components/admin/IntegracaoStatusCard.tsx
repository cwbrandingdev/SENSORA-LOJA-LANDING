"use client";

// Central de Integrações (Admin) — card de status somente-leitura,
// reaproveitado pelos 3 cards sem fluxo de conexão (Asaas, Resend,
// ImageKit). Mesmo padrão visual/comportamental de
// MelhorEnvioIntegracaoCard.tsx (Verificando.../Erro ao verificar/Tentar
// novamente), só sem o botão de ação — esses 3 nunca têm nada para
// "conectar", só um booleano de configuração que o backend já calcula (ver
// asaas.controller.ts/mail.controller.ts/imagekit.controller.ts).
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";

type StatusResposta = {
  configured: boolean;
  baseUrl?: string;
};

type IntegracaoStatusCardProps = {
  titulo: string;
  descricaoConfigurado: string;
  descricaoNaoConfigurado: string;
  buscarStatus: () => Promise<StatusResposta>;
};

export default function IntegracaoStatusCard({
  titulo,
  descricaoConfigurado,
  descricaoNaoConfigurado,
  buscarStatus,
}: IntegracaoStatusCardProps) {
  const [status, setStatus] = useState<StatusResposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarStatus = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await buscarStatus();
      setStatus(resposta);
    } catch (err) {
      setErro(getErrorMessage(err, "Não foi possível verificar a configuração."));
    } finally {
      setCarregando(false);
    }
  }, [buscarStatus]);

  useEffect(() => {
    carregarStatus();
  }, [carregarStatus]);

  const configurado = status?.configured ?? false;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-brand-navy">{titulo}</h3>

        {carregando ? (
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Verificando...
          </span>
        ) : erro ? (
          <span className="text-xs font-medium uppercase tracking-wide text-red-600">
            Erro ao verificar
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${
              configurado ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${configurado ? "bg-emerald-500" : "bg-slate-400"}`}
            />
            {configurado ? "Configurado" : "Não configurado"}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-500">
        {configurado ? descricaoConfigurado : descricaoNaoConfigurado}
      </p>

      {/* `baseUrl` só existe na resposta do Asaas, e só quando configurado —
          nunca um dado sensível (é só o host da API), ver
          AsaasService.baseUrlConfigurado (backend). */}
      {!erro && !carregando && configurado && status?.baseUrl && (
        <p className="text-xs text-slate-400">
          Base URL: <span className="font-mono">{status.baseUrl}</span>
        </p>
      )}

      {erro && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{erro}</span>
          <button
            type="button"
            onClick={carregarStatus}
            className="shrink-0 font-medium underline underline-offset-2 hover:text-red-800"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
