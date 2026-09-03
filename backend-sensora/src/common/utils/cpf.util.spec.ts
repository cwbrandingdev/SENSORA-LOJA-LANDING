import { cpfValido, normalizarCpf } from './cpf.util';

// Etapa — Dados do Cliente / Cadastro. CPFs de teste conhecidos/válidos
// (111.444.777-35 e 529.982.247-25 são amplamente usados como fixtures de
// teste de CPF — dígitos verificadores conferidos manualmente pelo
// algoritmo módulo 11 usado em cpf.util.ts).
describe('cpf.util', () => {
  describe('normalizarCpf', () => {
    it('remove pontuação, mantendo só os dígitos', () => {
      expect(normalizarCpf('111.444.777-35')).toBe('11144477735');
    });

    it('CPF já normalizado permanece igual', () => {
      expect(normalizarCpf('11144477735')).toBe('11144477735');
    });
  });

  describe('cpfValido', () => {
    it('CPF válido formatado', () => {
      expect(cpfValido('111.444.777-35')).toBe(true);
    });

    it('CPF válido já normalizado', () => {
      expect(cpfValido('52998224725')).toBe(true);
    });

    it('CPF inválido (dígito verificador incorreto)', () => {
      expect(cpfValido('123.456.789-00')).toBe(false);
    });

    it('CPF com todos os dígitos iguais é rejeitado, mesmo passando no módulo 11', () => {
      expect(cpfValido('111.111.111-11')).toBe(false);
      expect(cpfValido('00000000000')).toBe(false);
    });

    it('CPF com quantidade errada de dígitos', () => {
      expect(cpfValido('123456789')).toBe(false);
      expect(cpfValido('111.444.777-355')).toBe(false);
    });

    it('string vazia é inválida', () => {
      expect(cpfValido('')).toBe(false);
    });
  });
});
