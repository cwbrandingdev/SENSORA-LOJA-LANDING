import { isAxiosError } from "axios";

// Extrai uma mensagem segura para exibir ao usuário: usa a mensagem
// específica que o backend devolveu (ex.: 409 de categoria com produtos
// vinculados, validação de estoque em itens de pedido) quando existir,
// senão cai no fallback. Nunca expõe stack trace nem detalhes internos —
// só olha `response.data.message`, que é exatamente o que o
// HttpExceptionFilter do backend expõe de propósito.
export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    // Task 16: 5xx sempre cai no fallback da tela, nunca na mensagem do
    // backend — o AllExceptionsFilter (backend) devolve sempre a mesma
    // string fixa e técnica ("Internal server error") para qualquer erro
    // inesperado, exatamente para nunca vazar detalhe interno (Prisma,
    // Asaas, stack trace). Mostrar essa string ao cliente violaria o
    // próprio propósito dela; só as mensagens de erro 4xx (validação,
    // negócio) são pensadas para aparecer na tela.
    const status = error.response?.status;
    if (status !== undefined && status >= 500) {
      return fallback;
    }

    const message = (error.response?.data as { message?: string | string[] } | undefined)
      ?.message;

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
