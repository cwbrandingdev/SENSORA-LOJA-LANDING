import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { MelhorEnvioTokenCryptoService } from './melhor-envio-token-crypto.service';

// Etapa 8.4 (achado HIGH da auditoria — tokens do Melhor Envio em texto
// puro) — suíte dedicada ao mecanismo de criptografia (AES-256-GCM,
// node:crypto nativo). Cobre exatamente os requisitos da etapa: round-trip,
// IV nunca reutilizado (ciphertexts diferentes para o mesmo plaintext),
// adulteração de ciphertext/IV/authTag sempre falha, chave incorreta
// sempre falha, e NUNCA existe fallback para o valor original em caso de
// falha (isso reintroduziria a vulnerabilidade original).

function chaveValida(): string {
  return randomBytes(32).toString('base64');
}

function criarServico(chave?: string): MelhorEnvioTokenCryptoService {
  const configService = {
    get: (nomeChave: string) =>
      nomeChave === 'MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY' ? chave : undefined,
  } as unknown as ConfigService;
  return new MelhorEnvioTokenCryptoService(configService);
}

describe('MelhorEnvioTokenCryptoService', () => {
  const CHAVE = chaveValida();

  describe('formato', () => {
    it('encrypt() produz o formato versionado "v1:<iv>:<authTag>:<ciphertext>" (4 partes)', () => {
      const service = criarServico(CHAVE);
      const resultado = service.encrypt('access-token-original');

      const partes = resultado.split(':');
      expect(partes).toHaveLength(4);
      expect(partes[0]).toBe('v1');
      // As 3 partes seguintes devem ser Base64 válido e não vazio.
      for (const parte of partes.slice(1)) {
        expect(parte.length).toBeGreaterThan(0);
        expect(() => Buffer.from(parte, 'base64')).not.toThrow();
      }
    });
  });

  // Caso A
  describe('A — round trip', () => {
    it('encrypt() seguido de decrypt() devolve exatamente o plaintext original', () => {
      const service = criarServico(CHAVE);
      const original = 'meu-access-token-secreto-123';

      const criptografado = service.encrypt(original);
      const decifrado = service.decrypt(criptografado);

      expect(decifrado).toBe(original);
    });

    it('round trip funciona também para o refresh token (string diferente)', () => {
      const service = criarServico(CHAVE);
      const original = 'meu-refresh-token-secreto-456';

      expect(service.decrypt(service.encrypt(original))).toBe(original);
    });
  });

  // Caso B
  describe('B — IV aleatório, nunca reutilizado', () => {
    it('criptografar o mesmo token duas vezes produz ciphertexts diferentes (IV aleatório)', () => {
      const service = criarServico(CHAVE);
      const token = 'mesmo-token-duas-vezes';

      const primeiro = service.encrypt(token);
      const segundo = service.encrypt(token);

      expect(primeiro).not.toBe(segundo);
      // Os IVs (segunda parte) também precisam ser diferentes entre si —
      // é isso que prova que um novo IV aleatório foi gerado, não só que
      // o ciphertext mudou por acaso.
      expect(primeiro.split(':')[1]).not.toBe(segundo.split(':')[1]);
      // Ambos, mesmo assim, decifram para o mesmo plaintext original.
      expect(service.decrypt(primeiro)).toBe(token);
      expect(service.decrypt(segundo)).toBe(token);
    });
  });

  // Caso C
  describe('C — tampering no ciphertext', () => {
    it('ciphertext alterado falha ao descriptografar (nunca faz fallback para o plaintext original)', () => {
      const service = criarServico(CHAVE);
      const criptografado = service.encrypt('token-original');
      const [versao, iv, authTag, ciphertext] = criptografado.split(':');

      // Adultera um byte do ciphertext (inverte o primeiro caractere).
      const ciphertextAdulterado =
        (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1);
      const forjado = [versao, iv, authTag, ciphertextAdulterado].join(':');

      expect(() => service.decrypt(forjado)).toThrow(
        InternalServerErrorException,
      );
    });
  });

  // Caso D
  describe('D — tampering no IV', () => {
    it('IV alterado falha ao descriptografar', () => {
      const service = criarServico(CHAVE);
      const criptografado = service.encrypt('token-original');
      const [versao, iv, authTag, ciphertext] = criptografado.split(':');

      const ivAdulterado = (iv[0] === 'A' ? 'B' : 'A') + iv.slice(1);
      const forjado = [versao, ivAdulterado, authTag, ciphertext].join(':');

      expect(() => service.decrypt(forjado)).toThrow(
        InternalServerErrorException,
      );
    });
  });

  // Caso E
  describe('E — tampering no authTag', () => {
    it('authTag alterado falha ao descriptografar (autenticidade violada)', () => {
      const service = criarServico(CHAVE);
      const criptografado = service.encrypt('token-original');
      const [versao, iv, authTag, ciphertext] = criptografado.split(':');

      const authTagAdulterado =
        (authTag[0] === 'A' ? 'B' : 'A') + authTag.slice(1);
      const forjado = [versao, iv, authTagAdulterado, ciphertext].join(':');

      expect(() => service.decrypt(forjado)).toThrow(
        InternalServerErrorException,
      );
    });
  });

  // Caso F
  describe('F — chave incorreta', () => {
    it('decrypt() com uma chave diferente da usada no encrypt() falha', () => {
      const serviceA = criarServico(chaveValida());
      const serviceB = criarServico(chaveValida());
      const criptografado = serviceA.encrypt('token-original');

      expect(() => serviceB.decrypt(criptografado)).toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('fail-safe — chave ausente/inválida', () => {
    it('encrypt() sem MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY configurada lança, nunca grava plaintext', () => {
      const service = criarServico(undefined);
      expect(() => service.encrypt('token-qualquer')).toThrow(
        InternalServerErrorException,
      );
    });

    it('decrypt() sem MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY configurada lança', () => {
      const service = criarServico(undefined);
      expect(() => service.decrypt('v1:aa:bb:cc')).toThrow(
        InternalServerErrorException,
      );
    });

    it('chave com tamanho incorreto (não decodifica para 32 bytes) é rejeitada, nunca usada silenciosamente', () => {
      const chaveCurta = Buffer.from('chave-muito-curta').toString('base64');
      const service = criarServico(chaveCurta);

      expect(() => service.encrypt('token-qualquer')).toThrow(
        InternalServerErrorException,
      );
    });

    it('formato desconhecido/corrompido (sem o prefixo "v1:") é rejeitado', () => {
      const service = criarServico(CHAVE);
      expect(() => service.decrypt('nao-e-um-ciphertext-valido')).toThrow(
        InternalServerErrorException,
      );
    });
  });

  // Caso J — nunca vaza segredo em log
  describe('J — sem vazamento em logs', () => {
    it('nem o plaintext, nem o ciphertext, nem a chave aparecem em nenhuma chamada de log durante uma falha de descriptografia', () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const service = criarServico(CHAVE);
      const plaintext = 'access-token-super-secreto';
      const criptografado = service.encrypt(plaintext);
      const forjado = criptografado.slice(0, -1) + (criptografado.endsWith('A') ? 'B' : 'A');

      try {
        service.decrypt(forjado);
      } catch {
        // esperado
      }

      expect(errorSpy).toHaveBeenCalled();
      const argumentos = errorSpy.mock.calls.flat().map(String);
      for (const argumento of argumentos) {
        expect(argumento).not.toContain(plaintext);
        expect(argumento).not.toContain(CHAVE);
        expect(argumento).not.toContain(forjado);
      }

      errorSpy.mockRestore();
    });
  });
});
