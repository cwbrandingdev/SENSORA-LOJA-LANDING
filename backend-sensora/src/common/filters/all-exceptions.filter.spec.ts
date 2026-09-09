import { ArgumentsHost, BadGatewayException, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

// Achado da auditoria (Etapa 6.5, Frete) — cobre especificamente o que
// mudou neste filtro: repassar `code` (quando a própria exceção já o
// incluiu na resposta, ver MelhorEnvioService.comCodigoDeFrete) sem alterar
// o comportamento pré-existente (mensagem/status de HttpException comuns,
// e o 500 genérico para exceções não-HTTP nunca ganham `code`).
describe('AllExceptionsFilter', () => {
  function criarHostFake() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status };
    const request = { method: 'POST', url: '/checkout/frete/cotacao' };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  }

  it('repassa o `code` quando a exceção HttpException o inclui na resposta (erro seguro de frete)', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = criarHostFake();
    const excecao = new BadGatewayException({
      message: 'O Melhor Envio recusou a cotação',
      code: 'FRETE_MELHOR_ENVIO_INDISPONIVEL',
    });

    filter.catch(excecao, host);

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 502,
        message: 'O Melhor Envio recusou a cotação',
        code: 'FRETE_MELHOR_ENVIO_INDISPONIVEL',
      }),
    );
  });

  it('nunca inclui `code` para uma HttpException comum (sem o campo na resposta) — comportamento pré-existente preservado', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = criarHostFake();
    const excecao = new BadRequestException('O carrinho está vazio');

    filter.catch(excecao, host);

    expect(status).toHaveBeenCalledWith(400);
    const corpoEnviado = json.mock.calls[0][0] as Record<string, unknown>;
    expect(corpoEnviado.message).toBe('O carrinho está vazio');
    expect(corpoEnviado).not.toHaveProperty('code');
  });

  it('exceção não-HTTP (ex.: erro do Prisma) continua virando 500 genérico, sem `code` e sem detalhe interno', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = criarHostFake();
    const excecao = new Error('conexão com o banco recusada: senha=segredo123');

    filter.catch(excecao, host);

    expect(status).toHaveBeenCalledWith(500);
    const corpoEnviado = json.mock.calls[0][0] as Record<string, unknown>;
    expect(corpoEnviado.message).toBe('Internal server error');
    expect(corpoEnviado).not.toHaveProperty('code');
    expect(JSON.stringify(corpoEnviado)).not.toContain('segredo123');
  });
});
