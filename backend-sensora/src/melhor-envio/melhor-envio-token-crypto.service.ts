import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_CHAVE_BYTES = 32; // AES-256
const TAMANHO_IV_BYTES = 12; // tamanho recomendado (NIST SP 800-38D) para GCM
const VERSAO_FORMATO = 'v1';
const SEPARADOR = ':';

// Etapa 8.4 (achado HIGH da auditoria — tokens do Melhor Envio em texto
// puro) — criptografia autenticada REVERSÍVEL (AES-256-GCM, node:crypto
// nativo, sem dependência externa) para accessToken/refreshToken do Melhor
// Envio, que precisam continuar recuperáveis pelo backend para chamar a API
// (diferente de resetTokenHash/emailVerificationHash — hash não serve
// aqui, ver AuthService da Etapa 8.3). Único ponto do projeto que conhece
// detalhes de AES-GCM — MelhorEnvioService só chama encrypt()/decrypt(),
// nunca monta IV/cipher diretamente.
//
// Formato armazenado: "v1:<iv base64>:<authTag base64>:<ciphertext base64>"
// — versionado de propósito (permite trocar de algoritmo/formato no futuro
// sem quebrar valores já gravados, bastando reconhecer o prefixo).
//
// Validação da chave é PREGUIÇOSA (dentro de encrypt()/decrypt(), nunca no
// construtor) — mesmo padrão já usado por MELHOR_ENVIO_CLIENT_ID/
// CLIENT_SECRET/REDIRECT_URI em MelhorEnvioService.garantirCredenciaisConfiguradas():
// a integração com o Melhor Envio é opcional (ConfigModule.validationSchema
// em app.module.ts não exige nenhuma variável MELHOR_ENVIO_*), então exigir
// a chave no boot quebraria ambientes dev/CI que ainda não conectaram o
// Melhor Envio. Falha só acontece no caminho que de fato precisa
// persistir/ler um token — nunca mascarada, nunca com fallback para
// plaintext.
@Injectable()
export class MelhorEnvioTokenCryptoService {
  private readonly logger = new Logger(MelhorEnvioTokenCryptoService.name);

  constructor(private readonly configService: ConfigService) {}

  // IV aleatório a cada chamada — nunca reutilizado com a mesma chave (é
  // isso que torna GCM seguro; um IV repetido para a mesma chave quebra a
  // confidencialidade E a autenticidade do esquema inteiro).
  encrypt(plaintext: string): string {
    const chave = this.resolverChave();
    const iv = randomBytes(TAMANHO_IV_BYTES);

    const cipher = createCipheriv(ALGORITMO, chave, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      VERSAO_FORMATO,
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(SEPARADOR);
  }

  // Nunca faz fallback para o valor recebido em caso de falha — ciphertext
  // adulterado, IV/authTag incorretos, chave errada ou formato
  // desconhecido sempre lançam, nunca devolvem algo "utilizável" (isso
  // reintroduziria exatamente a vulnerabilidade que esta etapa corrige).
  decrypt(armazenado: string): string {
    const chave = this.resolverChave();

    try {
      const partes = armazenado.split(SEPARADOR);
      if (partes.length !== 4 || partes[0] !== VERSAO_FORMATO) {
        throw new Error('formato não reconhecido');
      }
      const [, ivBase64, authTagBase64, ciphertextBase64] = partes;

      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');
      const ciphertext = Buffer.from(ciphertextBase64, 'base64');

      const decipher = createDecipheriv(ALGORITMO, chave, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return plaintext.toString('utf8');
    } catch {
      // Log estático, de propósito — nunca inclui o ciphertext recebido
      // nem qualquer detalhe do erro nativo do módulo crypto (que poderia,
      // em tese, ecoar parte do buffer envolvido).
      this.logger.error(
        'Falha ao descriptografar token do Melhor Envio (ciphertext adulterado, IV/authTag incorretos, chave incorreta ou formato inválido).',
      );
      throw new InternalServerErrorException(
        'Não foi possível descriptografar o token armazenado.',
      );
    }
  }

  private resolverChave(): Buffer {
    const chaveConfigurada = this.configService.get<string>(
      'MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY',
    );
    if (!chaveConfigurada) {
      throw new InternalServerErrorException(
        'MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY não configurada — não é possível ' +
          'persistir nem ler tokens do Melhor Envio com segurança (nunca ' +
          'armazenamos em texto puro).',
      );
    }

    const chave = Buffer.from(chaveConfigurada, 'base64');
    if (chave.length !== TAMANHO_CHAVE_BYTES) {
      throw new InternalServerErrorException(
        `MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY inválida — precisa decodificar ` +
          `(Base64) para exatamente ${TAMANHO_CHAVE_BYTES} bytes (AES-256), ` +
          `recebido ${chave.length}.`,
      );
    }

    return chave;
  }
}
