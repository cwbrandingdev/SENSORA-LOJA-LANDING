"use client";

// Central de Integrações (Admin) — card de status somente-leitura,
// reaproveitado pelos 3 cards sem fluxo de conexão (Asaas, Resend,
// ImageKit). Mesmo padrão visual/comportamental de
// MelhorEnvioIntegracaoCard.tsx (Verificando.../Erro ao verificar/Tentar
// novamente).
//
// Vistoria das Integrações — `configured` (existia antes) e `operational`
// (novo) são conceitos DIFERENTES: `configured` só reflete presença de
// credencial (o `buscarStatus` original, sempre barato); `operational`
// começa `null` ("ainda não verificado") e só vira true/false quando o
// admin clica em "Verificar agora" (`verificarOperacional`, chamada real ao
// provedor, sob demanda — nunca automática a cada carregamento da página).
// `verificarOperacional` é opcional: Resend não recebe essa prop (Resend já
// foi validado em produção com envio real e não deve disparar nenhuma
// chamada nova aqui), então seu card nunca mostra o botão nem sai do estado
// "Configurado". `detalhes` generaliza o antigo tratamento especial só de
// `baseUrl` — cada integração informa os campos seguros (nunca secretos)
// que quer exibir.
import { useCallback, useEffect, useState } from "react";
import FormButton from "@/components/ui/FormButton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import { getErrorMessage } from "@/lib/errors";
import type { VerificacaoOperacionalResponse } from "@/lib/types/loja";

type StatusResposta = {
  configured: boolean;
};

type IntegracaoStatusCardProps<T extends StatusResposta> = {
  titulo: string;
  descricaoConfigurado: string;
  descricaoNaoConfigurado: string;
  buscarStatus: () => Promise<T>;
  // Extrai as linhas de detalhe seguras (label + valor) a exibir quando
  // configurado — ex.: Base URL (Asaas), Gateway ativo (Asaas), URL
  // Endpoint (ImageKit), Remetente (Resend). Nunca deve devolver um secret.
  detalhes?: (status: T) => Array<{ label: string; valor: string }>;
  // Presente só para Asaas/ImageKit/Melhor Envio (via componente próprio) —
  // ausente aqui, o card nunca mostra "Verificar agora" nem sai do estado
  // "Configurado" (caso do Resend).
  verificarOperacional?: () => Promise<VerificacaoOperacionalResponse>;
};

export default function IntegracaoStatusCard<T extends StatusResposta>({
  titulo,
  descricaoConfigurado,
  descricaoNaoConfigurado,
  buscarStatus,
  detalhes,
  verificarOperacional,
}: IntegracaoStatusCardProps<T>) {
  const [status, setStatus] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [operational, setOperational] = useState<boolean | null>(null);
  const [mensagemOperacional, setMensagemOperacional] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  const carregarStatus = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    // Toda recarga de status é um estado novo — a última verificação ao
    // vivo não se aplica mais a ela (mesmo raciocínio de nunca supor que um
    // resultado antigo ainda vale depois de um refresh).
    setOperational(null);
    setMensagemOperacional(null);
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

  async function handleVerificar() {
    if (!verificarOperacional || verificando) return;
    setVerificando(true);
    setMensagemOperacional(null);
    try {
      const resposta = await verificarOperacional();
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
  const linhasDetalhe = status && detalhes ? detalhes(status) : [];

  let corBadge = "text-slate-500";
  let corDot = "bg-slate-400";
  let textoBadge = "Não configurado";
  if (configurado) {
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
      textoBadge = "Configurado";
    }
  }

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
            className={`inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${corBadge}`}
          >
            <span aria-hidden className={`h-2 w-2 rounded-full ${corDot}`} />
            {textoBadge}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-500">
        {configurado ? descricaoConfigurado : descricaoNaoConfigurado}
      </p>

      {!erro && !carregando && configurado && linhasDetalhe.length > 0 && (
        <div className="flex flex-col gap-1">
          {linhasDetalhe.map((linha) => (
            <p key={linha.label} className="text-xs text-slate-400">
              {linha.label}: <span className="font-mono">{linha.valor}</span>
            </p>
          ))}
        </div>
      )}

      {erro && <InlineErrorState message={erro} onRetry={carregarStatus} />}

      {!erro && !carregando && configurado && verificarOperacional && (
        <div className="flex flex-col gap-2">
          <div>
            <FormButton variant="secondary" onClick={handleVerificar} disabled={verificando}>
              {verificando ? "Verificando..." : "Verificar agora"}
            </FormButton>
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
