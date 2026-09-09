import { isAxiosError } from "axios";

// Contrato explícito com o backend (ver MelhorEnvioService.comCodigoDeFrete
// e AllExceptionsFilter, backend-sensora) — só estes códigos identificam uma
// mensagem 5xx que o backend já sanitizou e produziu deliberadamente para
// aparecer na tela (nunca stack trace/SQL/segredo). Qualquer 5xx sem um
// destes códigos continua caindo no fallback genérico, exatamente como
// antes. Mantenha sincronizado com CODIGO_ERRO_FRETE_MELHOR_ENVIO no
// backend caso precise alterar o valor.
const CODIGOS_ERRO_SEGUROS = new Set(["FRETE_MELHOR_ENVIO_INDISPONIVEL"]);

// Extrai uma mensagem segura para exibir ao usuário: usa a mensagem
// específica que o backend devolveu (ex.: 409 de categoria com produtos
// vinculados, validação de estoque em itens de pedido) quando existir,
// senão cai no fallback. Nunca expõe stack trace nem detalhes internos —
// só olha `response.data.message`, que é exatamente o que o
// HttpExceptionFilter do backend expõe de propósito.
export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[]; code?: string }
      | undefined;

    // Task 16: 5xx sempre cai no fallback da tela, nunca na mensagem do
    // backend — o AllExceptionsFilter (backend) devolve sempre a mesma
    // string fixa e técnica ("Internal server error") para qualquer erro
    // inesperado, exatamente para nunca vazar detalhe interno (Prisma,
    // Asaas, stack trace). Mostrar essa string ao cliente violaria o
    // próprio propósito dela; só as mensagens de erro 4xx (validação,
    // negócio) são pensadas para aparecer na tela.
    //
    // Etapa 6.5 (Frete, achado da auditoria) — exceção a essa regra: um 5xx
    // com um `code` reconhecido em CODIGOS_ERRO_SEGUROS já foi
    // deliberadamente sanitizado pelo backend para o fluxo de frete (ver
    // MelhorEnvioService.comCodigoDeFrete) — sem isso, o cliente nunca via
    // o motivo real (Melhor Envio fora do ar, loja não conectada etc.), só
    // "Não foi possível calcular o frete. Tente novamente." mesmo quando o
    // backend já tinha uma mensagem específica e segura para mostrar.
    const status = error.response?.status;
    const erroSeguro =
      typeof data?.code === "string" && CODIGOS_ERRO_SEGUROS.has(data.code);
    if (status !== undefined && status >= 500 && !erroSeguro) {
      return fallback;
    }

    const message = data?.message;

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }

    // ValidationPipe do backend retorna `message` como array quando há mais
    // de um campo inválido — usa o primeiro em vez de descartar a mensagem.
    if (Array.isArray(message) && typeof message[0] === "string") {
      return message[0];
    }
  }

  return fallback;
}
