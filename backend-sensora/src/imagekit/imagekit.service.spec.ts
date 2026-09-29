import {
  BadGatewayException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ImageKit from 'imagekit';
import { ImagekitService } from './imagekit.service';

// Central de Integrações (Admin) — primeira suíte automatizada de
// ImagekitService. `ImageKit.prototype.listFiles` é mockado (nunca uma
// chamada de rede real) — mesmo raciocínio de fetch mockado em
// asaas.service.spec.ts/mail.service.spec.ts, só que aqui é o SDK oficial,
// não fetch direto. `new ImageKit(...)` em si não faz nenhuma chamada de
// rede (só monta o client), então instanciar ImagekitService normalmente é
// seguro nos testes.
describe('ImagekitService', () => {
  let service: ImagekitService;
  let configValues: Record<string, string>;

  beforeEach(() => {
    configValues = {
      IMAGEKIT_PUBLIC_KEY: 'public_fake',
      IMAGEKIT_PRIVATE_KEY: 'private_fake_nao_e_uma_chave_real',
      IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/sensora',
    };
    service = new ImagekitService({
      get: (key: string) => configValues[key],
    } as unknown as ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isConfigured / urlEndpointConfigurado', () => {
    it('configurado: isConfigured=true, urlEndpointConfigurado devolve a URL pública do CDN', () => {
      expect(service.isConfigured()).toBe(true);
      expect(service.urlEndpointConfigurado).toBe(
        'https://ik.imagekit.io/sensora',
      );
    });

    it('não configurado (falta uma das 3 variáveis): isConfigured=false, urlEndpointConfigurado undefined', () => {
      const semConfig = new ImagekitService({
        get: () => undefined,
      } as unknown as ConfigService);

      expect(semConfig.isConfigured()).toBe(false);
      expect(semConfig.urlEndpointConfigurado).toBeUndefined();
    });
  });

  describe('verificarOperacional (Central de Integrações)', () => {
    it('não configurado: operational=false, sem tentar chamar o SDK', async () => {
      const semConfig = new ImagekitService({
        get: () => undefined,
      } as unknown as ConfigService);
      const listFilesSpy = jest.spyOn(ImageKit.prototype, 'listFiles');

      const resultado = await semConfig.verificarOperacional();

      expect(resultado).toEqual({
        operational: false,
        mensagem: 'ImageKit não está configurado neste ambiente.',
      });
      expect(listFilesSpy).not.toHaveBeenCalled();
    });

    it('ImageKit responde OK: operational=true, lista no máximo 1 arquivo (read-only)', async () => {
      const listFilesSpy = jest
        .spyOn(ImageKit.prototype, 'listFiles')
        .mockResolvedValueOnce([] as never);

      const resultado = await service.verificarOperacional();

      expect(resultado).toEqual({ operational: true });
      expect(listFilesSpy).toHaveBeenCalledWith({ limit: 1 });
    });

    it('ImageKit recusa a chamada (ex.: private key inválida): operational=false com mensagem genérica, nunca o erro cru do SDK', async () => {
      jest
        .spyOn(ImageKit.prototype, 'listFiles')
        .mockRejectedValueOnce(
          new Error(
            'Your account cannot be authenticated (key: private_fake...)',
          ) as never,
        );

      const resultado = await service.verificarOperacional();

      expect(resultado.operational).toBe(false);
      expect(resultado.mensagem).toBe(
        'Não foi possível verificar a integração com o ImageKit.',
      );
      expect(resultado.mensagem).not.toContain('private_fake');
    });
  });

  // Evidências de devolução — SDK mockado (nenhuma chamada de rede), exceto
  // gerarUrlAssinada, que é só um cálculo local (HMAC) e roda de verdade.
  describe('enviarArquivoPrivado', () => {
    it('envia como arquivo PRIVADO, na pasta e com o nome definidos pelo backend, e devolve só fileId/caminho', async () => {
      const uploadSpy = jest
        .spyOn(ImageKit.prototype, 'upload')
        .mockResolvedValueOnce({
          fileId: 'file_123',
          filePath: '/sensora/devolucoes/5/evidencia_abc.jpg',
          url: 'https://ik.imagekit.io/sensora/sensora/devolucoes/5/evidencia_abc.jpg',
        } as never);
      const conteudo = Buffer.from([0xff, 0xd8, 0xff]);

      const resultado = await service.enviarArquivoPrivado(
        conteudo,
        'evidencia.jpg',
        '/sensora/devolucoes/5',
      );

      expect(uploadSpy).toHaveBeenCalledWith({
        file: conteudo,
        fileName: 'evidencia.jpg',
        folder: '/sensora/devolucoes/5',
        isPrivateFile: true,
        useUniqueFileName: true,
      });
      expect(resultado).toEqual({
        fileId: 'file_123',
        caminho: '/sensora/devolucoes/5/evidencia_abc.jpg',
      });
    });

    it('falha do ImageKit vira BadGatewayException com mensagem genérica', async () => {
      jest
        .spyOn(ImageKit.prototype, 'upload')
        .mockRejectedValueOnce(new Error('detalhe interno da conta') as never);

      await expect(
        service.enviarArquivoPrivado(Buffer.from([1]), 'evidencia.jpg', '/x'),
      ).rejects.toThrow(
        new BadGatewayException('Não foi possível enviar a imagem.'),
      );
    });

    it('ImageKit não configurado: erro, sem tentar enviar', async () => {
      const semConfig = new ImagekitService({
        get: () => undefined,
      } as unknown as ConfigService);
      const uploadSpy = jest.spyOn(ImageKit.prototype, 'upload');

      await expect(
        semConfig.enviarArquivoPrivado(Buffer.from([1]), 'evidencia.jpg', '/x'),
      ).rejects.toThrow(InternalServerErrorException);
      expect(uploadSpy).not.toHaveBeenCalled();
    });
  });

  describe('gerarUrlAssinada', () => {
    it('gera URL assinada (ik-s) com expiração (ik-t) para o caminho informado', () => {
      const antes = Math.floor(Date.now() / 1000);

      const url = new URL(
        service.gerarUrlAssinada(
          '/sensora/devolucoes/5/evidencia_abc.jpg',
          600,
        ),
      );

      expect(url.origin + url.pathname).toBe(
        'https://ik.imagekit.io/sensora/sensora/devolucoes/5/evidencia_abc.jpg',
      );
      expect(url.searchParams.get('ik-s')).toBeTruthy();
      const expira = Number(url.searchParams.get('ik-t'));
      expect(expira).toBeGreaterThanOrEqual(antes + 600);
      expect(expira).toBeLessThanOrEqual(antes + 602);
    });
  });

  describe('apagarArquivo', () => {
    it('apaga pelo fileId', async () => {
      const deleteSpy = jest
        .spyOn(ImageKit.prototype, 'deleteFile')
        .mockResolvedValueOnce({} as never);

      await service.apagarArquivo('file_123');

      expect(deleteSpy).toHaveBeenCalledWith('file_123');
    });

    it('arquivo que já não existe no ImageKit (404) conta como apagado', async () => {
      jest.spyOn(ImageKit.prototype, 'deleteFile').mockRejectedValueOnce({
        message: 'The requested file does not exist.',
        $ResponseMetadata: { statusCode: 404 },
      } as never);

      await expect(
        service.apagarArquivo('file_sumiu'),
      ).resolves.toBeUndefined();
    });

    it('outra falha do ImageKit vira BadGatewayException', async () => {
      jest.spyOn(ImageKit.prototype, 'deleteFile').mockRejectedValueOnce({
        message: 'Internal error',
        $ResponseMetadata: { statusCode: 500 },
      } as never);

      await expect(service.apagarArquivo('file_123')).rejects.toThrow(
        new BadGatewayException('Não foi possível apagar a imagem.'),
      );
    });
  });
});
