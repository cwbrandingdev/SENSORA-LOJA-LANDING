import { BadRequestException } from '@nestjs/common';
import {
  AreaEntregaForaDoRaioError,
  CODIGO_ERRO_AREA_ENTREGA,
  MENSAGEM_FORA_DA_AREA,
  ORIGEM_ENTREGA,
  RAIO_ENTREGA_KM,
  cepDeCuritiba,
  cepMetropolitanoProvavel,
  distanciaKm,
  garantirCepNaAreaDeEntrega,
  limparCacheAreaEntrega,
  normalizarCep,
} from './area-entrega';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('area-entrega', () => {
  beforeEach(() => {
    limparCacheAreaEntrega();
  });

  describe('normalizarCep / faixas', () => {
    it('remove hífen e deixa só dígitos', () => {
      expect(normalizarCep('80410-240')).toBe('80410240');
    });

    it('80000–82999 é Curitiba', () => {
      expect(cepDeCuritiba('80000-000')).toBe(true);
      expect(cepDeCuritiba('80410-240')).toBe(true);
      expect(cepDeCuritiba('82999-999')).toBe(true);
      expect(cepDeCuritiba('83000-000')).toBe(false);
    });

    it('83000–83899 é metropolitana (fallback)', () => {
      expect(cepMetropolitanoProvavel('83010-000')).toBe(true);
      expect(cepMetropolitanoProvavel('83200-000')).toBe(true);
      expect(cepMetropolitanoProvavel('84000-000')).toBe(false);
    });
  });

  describe('distanciaKm', () => {
    it('origem para si mesma é 0', () => {
      expect(distanciaKm(ORIGEM_ENTREGA, ORIGEM_ENTREGA)).toBe(0);
    });

    it('São José dos Pinhais fica dentro do raio', () => {
      const sjp = { lat: -25.5317, lng: -49.2081 };
      expect(distanciaKm(ORIGEM_ENTREGA, sjp)).toBeLessThan(RAIO_ENTREGA_KM);
    });

    it('São Paulo fica fora do raio', () => {
      const sp = { lat: -23.5614, lng: -46.6558 };
      expect(distanciaKm(ORIGEM_ENTREGA, sp)).toBeGreaterThan(RAIO_ENTREGA_KM);
    });

    it('Joinville fica fora do raio', () => {
      const joinville = { lat: -26.3045, lng: -48.8487 };
      expect(distanciaKm(ORIGEM_ENTREGA, joinville)).toBeGreaterThan(
        RAIO_ENTREGA_KM,
      );
    });
  });

  describe('garantirCepNaAreaDeEntrega', () => {
    it('CEP de Curitiba é aceito sem geocodificar', async () => {
      const fetchFn = jest.fn();
      await expect(
        garantirCepNaAreaDeEntrega('80410-240', { fetchFn }),
      ).resolves.toBeUndefined();
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('CEP inválido é rejeitado antes de geocodificar', async () => {
      const fetchFn = jest.fn();
      await expect(
        garantirCepNaAreaDeEntrega('123', { fetchFn }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('CEP geocodificado dentro do raio é aceito', async () => {
      const fetchFn = jest.fn().mockResolvedValue(
        jsonResponse({ lat: '-25.5317', lng: '-49.2081' }),
      );

      await expect(
        garantirCepNaAreaDeEntrega('83010-000', { fetchFn }),
      ).resolves.toBeUndefined();
      expect(fetchFn).toHaveBeenCalled();
    });

    it('CEP geocodificado fora do raio lança com código e mensagem próprios', async () => {
      const fetchFn = jest.fn().mockResolvedValue(
        jsonResponse({ lat: '-23.5614', lng: '-46.6558' }),
      );

      const erro = await garantirCepNaAreaDeEntrega('01310-100', {
        fetchFn,
      }).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(AreaEntregaForaDoRaioError);
      expect(erro).toBeInstanceOf(BadRequestException);
      const resposta = (erro as AreaEntregaForaDoRaioError).getResponse();
      expect(resposta).toEqual({
        message: MENSAGEM_FORA_DA_AREA,
        code: CODIGO_ERRO_AREA_ENTREGA,
      });
    });

    it('sem coordenadas, CEP metropolitano ainda é aceito (fallback)', async () => {
      const fetchFn = jest.fn().mockResolvedValue(jsonResponse({}, false, 404));

      await expect(
        garantirCepNaAreaDeEntrega('83010-000', { fetchFn }),
      ).resolves.toBeUndefined();
    });

    it('sem coordenadas, CEP longe (ex.: São Paulo) é recusado', async () => {
      const fetchFn = jest.fn().mockResolvedValue(jsonResponse({}, false, 404));

      await expect(
        garantirCepNaAreaDeEntrega('01310-100', { fetchFn }),
      ).rejects.toBeInstanceOf(AreaEntregaForaDoRaioError);
    });

    it('tenta BrasilAPI quando a AwesomeAPI não devolve coordenadas', async () => {
      const fetchFn = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse({}, false, 404))
        .mockResolvedValueOnce(
          jsonResponse({
            location: {
              coordinates: { latitude: '-25.5317', longitude: '-49.2081' },
            },
          }),
        );

      await expect(
        garantirCepNaAreaDeEntrega('83010-000', { fetchFn }),
      ).resolves.toBeUndefined();
      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(String(fetchFn.mock.calls[1][0])).toContain('brasilapi.com.br');
    });

    it('reusa o cache na segunda consulta do mesmo CEP', async () => {
      const fetchFn = jest.fn().mockResolvedValue(
        jsonResponse({ lat: '-23.5614', lng: '-46.6558' }),
      );

      await expect(
        garantirCepNaAreaDeEntrega('01310-100', { fetchFn }),
      ).rejects.toBeInstanceOf(AreaEntregaForaDoRaioError);
      await expect(
        garantirCepNaAreaDeEntrega('01310-100', { fetchFn }),
      ).rejects.toBeInstanceOf(AreaEntregaForaDoRaioError);

      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });
});
