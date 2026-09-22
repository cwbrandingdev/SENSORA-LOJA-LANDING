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
      expect(service.urlEndpointConfigurado).toBe('https://ik.imagekit.io/sensora');
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
});
