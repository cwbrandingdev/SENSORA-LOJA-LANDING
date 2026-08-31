import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface HttpExceptionResponseObject {
  message: string | string[];
}

const GENERIC_SERVER_ERROR_MESSAGE = 'Internal server error';

// Etapa 10 / Task 6 (achados H5 + H6): substitui o antigo
// HttpExceptionFilter (@Catch(HttpException) apenas) por um filtro global
// único — evita duplicar a lógica de extrair status/message de uma
// HttpException, que continua exatamente igual a antes (ver
// resolverResposta). A diferença é que agora QUALQUER exceção que não seja
// uma HttpException (erro do Prisma, falha de infraestrutura, bug não
// previsto) também é capturada aqui, em vez de cair no handler padrão do
// Nest fora do nosso controle: vira 500 genérico para o cliente, com o
// erro real (stack trace) só no log do servidor.
//
// NUNCA logar aqui: corpo da requisição, headers (Authorization/cookies),
// senha, token, JWT_SECRET, IMAGEKIT_PRIVATE_KEY ou qualquer outro dado do
// payload — só method/path/status/stack trace da própria exceção.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message } = this.resolverResposta(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }

  private resolverResposta(exception: unknown): {
    statusCode: number;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as HttpExceptionResponseObject).message;
      return { statusCode, message };
    }

    // Qualquer exceção não-HTTP (ex.: PrismaClientKnownRequestError, erro
    // de conexão, bug inesperado) nunca deve chegar ao cliente com detalhe
    // interno — sempre 500 genérico. O @Catch() global é suficiente para
    // isso; não há necessidade de distinguir códigos específicos do Prisma
    // aqui, porque os fluxos que precisam de um status diferenciado (ex.:
    // 409 ao excluir produto/categoria vinculados) já fazem essa checagem
    // manualmente antes de chegar num erro do Prisma (ver
    // produtos.service.ts/categorias.service.ts) — um erro do Prisma que
    // chegue até aqui é, por definição, um caso não previsto.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: GENERIC_SERVER_ERROR_MESSAGE,
    };
  }
}
