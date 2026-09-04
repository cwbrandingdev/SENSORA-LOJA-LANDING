import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RefreshTokenDto } from './refresh-token.dto';
import { ResetPasswordDto } from './reset-password.dto';
import { VerifyEmailDto } from './verify-email.dto';

// Etapa 8.10 (hardening LOW — achado da auditoria) — prova, via o mesmo
// `class-validator` que o ValidationPipe global usa em runtime (main.ts),
// que os três tokens gerados pelo próprio sistema (refresh, reset de
// senha, confirmação de e-mail — todos `randomBytes(32).toString('hex')`,
// sempre 64 caracteres, ver AuthService) agora rejeitam entradas
// absurdamente grandes, e que um token real (64 chars) continua aceito
// normalmente — a defesa não pode invalidar tokens legítimos.

const TOKEN_REAL_64_CHARS =
  'a'.repeat(64); // formato real: sempre exatamente 64 chars hexadecimais

describe('DTOs de token (refresh/reset/verify-email) — limite de tamanho (Etapa 8.10)', () => {
  it('RefreshTokenDto: token real de 64 caracteres passa na validação', async () => {
    const dto = plainToInstance(RefreshTokenDto, {
      refresh_token: TOKEN_REAL_64_CHARS,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('RefreshTokenDto: entrada absurdamente grande (10.000 caracteres) é rejeitada', async () => {
    const dto = plainToInstance(RefreshTokenDto, {
      refresh_token: 'a'.repeat(10_000),
    });
    const erros = await validate(dto);
    expect(erros).not.toHaveLength(0);
    expect(erros[0].constraints).toHaveProperty('maxLength');
  });

  it('ResetPasswordDto: token real de 64 caracteres passa na validação', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: TOKEN_REAL_64_CHARS,
      novaSenha: 'senha1234',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('ResetPasswordDto: entrada absurdamente grande no token é rejeitada', async () => {
    const dto = plainToInstance(ResetPasswordDto, {
      token: 'a'.repeat(10_000),
      novaSenha: 'senha1234',
    });
    const erros = await validate(dto);
    const erroToken = erros.find((erro) => erro.property === 'token');
    expect(erroToken?.constraints).toHaveProperty('maxLength');
  });

  it('VerifyEmailDto: token real de 64 caracteres passa na validação', async () => {
    const dto = plainToInstance(VerifyEmailDto, {
      token: TOKEN_REAL_64_CHARS,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('VerifyEmailDto: entrada absurdamente grande no token é rejeitada', async () => {
    const dto = plainToInstance(VerifyEmailDto, {
      token: 'a'.repeat(10_000),
    });
    const erros = await validate(dto);
    expect(erros[0].constraints).toHaveProperty('maxLength');
  });
});
