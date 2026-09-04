// Etapa 8.4 (achado HIGH da auditoria — tokens do Melhor Envio em texto
// puro) — migração CONTROLADA e IDEMPOTENTE do MelhorEnvioToken já
// existente no banco: criptografa accessToken/refreshToken que ainda
// estejam em texto puro, usando a mesma chave/algoritmo de
// MelhorEnvioTokenCryptoService (AES-256-GCM).
//
// NÃO é uma migration do Prisma — nenhuma coluna muda de tipo (accessToken/
// refreshToken continuam String, só o CONTEÚDO gravado muda de plaintext
// para ciphertext), então não há schema a migrar. É um script operacional,
// pensado para ser rodado manualmente UMA VEZ por ambiente (dev/produção),
// depois do deploy do código desta etapa — nenhuma secret real fica
// embutida aqui nem em nenhuma migration versionada; a chave é sempre lida
// do ambiente (MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY), nunca hardcoded.
//
// Idempotente: reconhece o prefixo "v1:" (MelhorEnvioTokenCryptoService) e
// pula qualquer valor que já esteja criptografado — pode ser executado
// novamente sem risco (ex.: reexecução acidental, ou rodar de novo depois
// de confirmar que a primeira execução funcionou).
//
// Uso (depois de `npm run build`, com DATABASE_URL e
// MELHOR_ENVIO_TOKEN_ENCRYPTION_KEY já exportadas no ambiente que vai
// rodar o script — nunca passadas na linha de comando, onde ficariam no
// histórico do shell):
//
//   node dist/src/melhor-envio/scripts/migrar-tokens-melhor-envio.js
//
// Nunca imprime accessToken/refreshToken (nem em texto puro, nem
// criptografado) — só um resumo booleano do que foi feito.
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../../generated/prisma/client';
import { MelhorEnvioTokenCryptoService } from '../melhor-envio-token-crypto.service';

const PREFIXO_CRIPTOGRAFADO = 'v1:';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada no ambiente.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  // Mesmo padrão de ConfigService "de mentira" já usado nos testes deste
  // projeto (só repassa process.env) — este script roda fora do contexto
  // de DI do Nest, então nunca instanciamos o ConfigModule inteiro só para
  // isto.
  const configService = {
    get: (chave: string) => process.env[chave],
  } as unknown as ConfigService;
  const tokenCrypto = new MelhorEnvioTokenCryptoService(configService);

  try {
    const token = await prisma.melhorEnvioToken.findUnique({
      where: { id: 1 },
    });

    if (!token) {
      console.log('Nenhum MelhorEnvioToken encontrado no banco — nada a migrar.');
      return;
    }

    const accessJaCriptografado = token.accessToken.startsWith(
      PREFIXO_CRIPTOGRAFADO,
    );
    const refreshJaCriptografado = token.refreshToken.startsWith(
      PREFIXO_CRIPTOGRAFADO,
    );

    if (accessJaCriptografado && refreshJaCriptografado) {
      console.log(
        'MelhorEnvioToken já está criptografado (formato v1) — nada a fazer.',
      );
      return;
    }

    const novoAccessToken = accessJaCriptografado
      ? token.accessToken
      : tokenCrypto.encrypt(token.accessToken);
    const novoRefreshToken = refreshJaCriptografado
      ? token.refreshToken
      : tokenCrypto.encrypt(token.refreshToken);

    await prisma.melhorEnvioToken.update({
      where: { id: 1 },
      data: { accessToken: novoAccessToken, refreshToken: novoRefreshToken },
    });

    console.log(
      'Migração concluída: ' +
        `accessToken ${accessJaCriptografado ? 'já estava criptografado' : 'criptografado agora'}, ` +
        `refreshToken ${refreshJaCriptografado ? 'já estava criptografado' : 'criptografado agora'}.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((erro: unknown) => {
  console.error(
    'Falha na migração de tokens do Melhor Envio:',
    erro instanceof Error ? erro.message : erro,
  );
  process.exitCode = 1;
});
