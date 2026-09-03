import { normalizarTelefone, telefoneValido } from './telefone.util';

describe('telefone.util', () => {
  describe('normalizarTelefone', () => {
    it('remove formatação, mantendo só os dígitos', () => {
      expect(normalizarTelefone('(41) 99999-9999')).toBe('41999999999');
    });

    it('telefone já normalizado permanece igual', () => {
      expect(normalizarTelefone('41999999999')).toBe('41999999999');
    });
  });

  describe('telefoneValido', () => {
    it('celular formatado (11 dígitos)', () => {
      expect(telefoneValido('(41) 99999-9999')).toBe(true);
    });

    it('celular normalizado (11 dígitos)', () => {
      expect(telefoneValido('41999999999')).toBe(true);
    });

    it('fixo formatado (10 dígitos)', () => {
      expect(telefoneValido('(41) 3333-3333')).toBe(true);
    });

    it('fixo normalizado (10 dígitos)', () => {
      expect(telefoneValido('4133333333')).toBe(true);
    });

    it('rejeita quantidade de dígitos incompatível', () => {
      expect(telefoneValido('123456')).toBe(false);
      expect(telefoneValido('419999999999999')).toBe(false);
    });

    it('string vazia é inválida', () => {
      expect(telefoneValido('')).toBe(false);
    });
  });
});
