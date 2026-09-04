import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';

// Etapa 6.4 (Confirmação de e-mail) — primeira suíte de testes automatizados
// de AuthService neste projeto. Cobre especificamente o fluxo novo
// (register/verifyEmail/resendVerification) mais os pontos de integração
// exigidos pela auditoria (login não bloqueado por falta de confirmação,
// nenhuma autenticação automática na confirmação). Login/refresh/logout/
// forgot-password/reset-password/change-password JÁ existentes não são
// re-testados aqui além do necessário para provar G — não são o escopo
// desta etapa e não foram alterados.
//
// bcrypt: usado de verdade (não mockado) com SALT_ROUNDS baixo só nesta
// suíte (4, em vez dos 10 de produção) — mais rápido e ainda prova o
// comportamento real de bcrypt.compare, em vez de assumir que funcionaria.

const SALT_ROUNDS_TESTE = 4;
const SENHA_HASH_TESTE = bcrypt.hashSync('senhaCorreta123', SALT_ROUNDS_TESTE);

function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

describe('AuthService', () => {
  let service: AuthService;
  let usuariosService: {
    buscarPorEmail: jest.Mock;
    create: jest.Mock;
    emitirTokenVerificacaoEmail: jest.Mock;
    buscarPorHashVerificacaoEmail: jest.Mock;
    confirmarEmailSeHashValido: jest.Mock;
    criarRefreshToken: jest.Mock;
    salvarTokenReset: jest.Mock;
    buscarPorResetToken: jest.Mock;
    redefinirSenha: jest.Mock;
    revogarTodosRefreshTokensAtivos: jest.Mock;
  };
  let mailService: { enviarEmail: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let configValues: Record<string, string>;

  beforeEach(async () => {
    usuariosService = {
      buscarPorEmail: jest.fn(),
      create: jest.fn(),
      emitirTokenVerificacaoEmail: jest.fn(),
      buscarPorHashVerificacaoEmail: jest.fn(),
      confirmarEmailSeHashValido: jest.fn(),
      criarRefreshToken: jest.fn(),
      salvarTokenReset: jest.fn(),
      buscarPorResetToken: jest.fn(),
      redefinirSenha: jest.fn(),
      revogarTodosRefreshTokensAtivos: jest.fn(),
    };
    mailService = { enviarEmail: jest.fn() };
    jwtService = { sign: jest.fn(() => 'access-token-fake') };
    configValues = {
      FRONTEND_URL: 'http://localhost:3002',
      REFRESH_TOKEN_EXPIRES_IN: '604800',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsuariosService, useValue: usuariosService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register — Etapa 6.4', () => {
    // A
    it('A: cria o usuário com emailVerificado:false (cadastro público, opções explícitas)', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce(null);
      usuariosService.create.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente Teste',
        email: 'cliente@sensora.dev',
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
        emailVerificado: false,
      });

      await service.register({
        nome: 'Cliente Teste',
        email: 'cliente@sensora.dev',
        senha: 'senhaSegura123',
      });

      expect(usuariosService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: 'Cliente Teste',
          email: 'cliente@sensora.dev',
          perfil: PerfilUsuario.CLIENTE,
        }),
        { emailVerificado: false },
      );
    });

    // B
    it('B: dispara o e-mail de confirmação automaticamente após criar a conta', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce(null);
      usuariosService.create.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente Teste',
        email: 'cliente@sensora.dev',
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
        emailVerificado: false,
      });

      await service.register({
        nome: 'Cliente Teste',
        email: 'cliente@sensora.dev',
        senha: 'senhaSegura123',
      });

      expect(usuariosService.emitirTokenVerificacaoEmail).toHaveBeenCalledWith(
        1,
        expect.any(String),
        expect.any(Date),
      );
      expect(mailService.enviarEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'cliente@sensora.dev',
          subject: 'Confirme seu e-mail',
        }),
      );
    });

    // O
    it('O: o token nunca é persistido em texto puro — o valor gravado é o hash SHA-256 do token enviado por e-mail', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce(null);
      usuariosService.create.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente Teste',
        email: 'cliente@sensora.dev',
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
        emailVerificado: false,
      });

      await service.register({
        nome: 'Cliente Teste',
        email: 'cliente@sensora.dev',
        senha: 'senhaSegura123',
      });

      const hashPersistido =
        usuariosService.emitirTokenVerificacaoEmail.mock.calls[0][1];
      const linkEnviado = (mailService.enviarEmail.mock.calls[0][0] as {
        html: string;
      }).html;
      const tokenNoLink = /token=([0-9a-f]+)/.exec(linkEnviado)?.[1];

      expect(tokenNoLink).toBeDefined();
      // O token em texto puro (o que vai no link do e-mail) nunca é igual ao
      // que foi persistido — o que foi persistido é o hash dele.
      expect(hashPersistido).not.toBe(tokenNoLink);
      expect(hashPersistido).toBe(sha256(tokenNoLink as string));
      // Nunca em texto puro: o hash persistido não pode conter o próprio
      // token como substring nem ser reversível trivialmente.
      expect(hashPersistido).toHaveLength(64); // sha256 hex = 64 chars
    });

    // P (parte 1: register nunca autentica)
    it('P: register não retorna nem gera nenhum token de autenticação', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce(null);
      usuariosService.create.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente Teste',
        email: 'cliente@sensora.dev',
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
        emailVerificado: false,
      });

      const resultado = await service.register({
        nome: 'Cliente Teste',
        email: 'cliente@sensora.dev',
        senha: 'senhaSegura123',
      });

      expect(resultado).not.toHaveProperty('access_token');
      expect(resultado).not.toHaveProperty('refresh_token');
      expect(usuariosService.criarRefreshToken).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail — Etapa 6.4', () => {
    // C
    it('C: token válido confirma o e-mail', async () => {
      usuariosService.buscarPorHashVerificacaoEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        emailVerificado: false,
        emailVerificationExpiry: new Date(Date.now() + 60 * 60 * 1000),
      });
      usuariosService.confirmarEmailSeHashValido.mockResolvedValueOnce(1);

      const resultado = await service.verifyEmail({ token: 'token-valido' });

      expect(resultado.message).toBe('E-mail confirmado com sucesso.');
      expect(usuariosService.confirmarEmailSeHashValido).toHaveBeenCalledWith(
        1,
        sha256('token-valido'),
      );
    });

    // D
    it('D: token expirado é rejeitado', async () => {
      usuariosService.buscarPorHashVerificacaoEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        emailVerificado: false,
        emailVerificationExpiry: new Date(Date.now() - 1000),
      });

      await expect(
        service.verifyEmail({ token: 'token-expirado' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usuariosService.confirmarEmailSeHashValido).not.toHaveBeenCalled();
    });

    // E
    it('E: token inválido (nenhum usuário com esse hash) é rejeitado', async () => {
      usuariosService.buscarPorHashVerificacaoEmail.mockResolvedValueOnce(null);

      await expect(
        service.verifyEmail({ token: 'token-que-nao-existe' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usuariosService.confirmarEmailSeHashValido).not.toHaveBeenCalled();
    });

    // F
    it('F: token já usado (segunda tentativa) não permite nova alteração indevida — encontra o usuário já verificado e não regrava nada', async () => {
      usuariosService.buscarPorHashVerificacaoEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        emailVerificado: true,
        emailVerificationExpiry: null,
      });

      const resultado = await service.verifyEmail({ token: 'token-ja-usado' });

      expect(resultado.message).toBe('Este e-mail já foi confirmado.');
      expect(usuariosService.confirmarEmailSeHashValido).not.toHaveBeenCalled();
    });

    it('F (corrida): confirmarEmailSeHashValido retornando 0 (já confirmado por outra chamada concorrente) também não é tratado como erro', async () => {
      usuariosService.buscarPorHashVerificacaoEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        emailVerificado: false,
        emailVerificationExpiry: new Date(Date.now() + 60 * 60 * 1000),
      });
      usuariosService.confirmarEmailSeHashValido.mockResolvedValueOnce(0);

      const resultado = await service.verifyEmail({ token: 'token-corrida' });

      expect(resultado.message).toBe('Este e-mail já foi confirmado.');
    });

    // P (parte 2: confirmação nunca autentica)
    it('P: confirmar o e-mail não emite nenhum token de autenticação', async () => {
      usuariosService.buscarPorHashVerificacaoEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        emailVerificado: false,
        emailVerificationExpiry: new Date(Date.now() + 60 * 60 * 1000),
      });
      usuariosService.confirmarEmailSeHashValido.mockResolvedValueOnce(1);

      const resultado = await service.verifyEmail({ token: 'token-valido' });

      expect(resultado).not.toHaveProperty('access_token');
      expect(resultado).not.toHaveProperty('refresh_token');
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(usuariosService.criarRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification — Etapa 6.4', () => {
    // J
    it('J: gera um token novo e o token anterior deixa de ser válido (sobrescrito)', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        emailVerificado: false,
        // Token atual "emitido" há mais de 1 minuto — fora do cooldown.
        emailVerificationExpiry: new Date(
          Date.now() + 48 * 60 * 60 * 1000 - 2 * 60 * 1000,
        ),
      });

      await service.resendVerification({ email: 'cliente@sensora.dev' });

      expect(usuariosService.emitirTokenVerificacaoEmail).toHaveBeenCalledTimes(1);
      const [, novoHash] =
        usuariosService.emitirTokenVerificacaoEmail.mock.calls[0];
      // O novo hash persistido é derivado do NOVO token enviado por e-mail,
      // nunca do token antigo — a chamada sobrescreve hash/expiração, então
      // qualquer link antigo deixa de bater na próxima confirmação.
      const linkEnviado = (mailService.enviarEmail.mock.calls[0][0] as {
        html: string;
      }).html;
      const novoTokenNoLink = /token=([0-9a-f]+)/.exec(linkEnviado)?.[1];
      expect(novoHash).toBe(sha256(novoTokenNoLink as string));
    });

    // K
    it('K: não revela se o e-mail existe — mesma mensagem para e-mail inexistente, já confirmado, ou reenviado de verdade', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce(null);
      const respostaInexistente = await service.resendVerification({
        email: 'nao-existe@sensora.dev',
      });

      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 2,
        nome: 'Cliente',
        email: 'ja-confirmado@sensora.dev',
        emailVerificado: true,
        emailVerificationExpiry: null,
      });
      const respostaJaConfirmado = await service.resendVerification({
        email: 'ja-confirmado@sensora.dev',
      });

      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 3,
        nome: 'Cliente',
        email: 'pendente@sensora.dev',
        emailVerificado: false,
        emailVerificationExpiry: null,
      });
      const respostaReenviada = await service.resendVerification({
        email: 'pendente@sensora.dev',
      });

      expect(respostaInexistente.message).toBe(respostaJaConfirmado.message);
      expect(respostaJaConfirmado.message).toBe(respostaReenviada.message);
      // Confirma que só o terceiro caso de fato reenviou (senão o teste L
      // abaixo é que estaria testando o comportamento certo).
      expect(mailService.enviarEmail).toHaveBeenCalledTimes(1);
    });

    // L
    it('L: rate limit por e-mail-alvo — reenvio pedido menos de 60s após o token atual ter sido emitido não gera novo envio', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        emailVerificado: false,
        // Token "emitido" há 10 segundos — dentro do cooldown de 60s.
        emailVerificationExpiry: new Date(
          Date.now() + 48 * 60 * 60 * 1000 - 10 * 1000,
        ),
      });

      const resultado = await service.resendVerification({
        email: 'cliente@sensora.dev',
      });

      expect(resultado.message).toMatch(/novo link de confirmação/);
      expect(usuariosService.emitirTokenVerificacaoEmail).not.toHaveBeenCalled();
      expect(mailService.enviarEmail).not.toHaveBeenCalled();
    });

    it('reenvio permitido quando nunca houve token emitido (emailVerificationExpiry nulo)', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        emailVerificado: false,
        emailVerificationExpiry: null,
      });

      await service.resendVerification({ email: 'cliente@sensora.dev' });

      expect(usuariosService.emitirTokenVerificacaoEmail).toHaveBeenCalledTimes(1);
      expect(mailService.enviarEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('login — preservado (Etapa 6.4 não deve alterar este comportamento)', () => {
    // G
    it('G: login continua funcionando normalmente para uma conta com e-mail ainda não confirmado', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        senha: SENHA_HASH_TESTE,
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
        emailVerificado: false,
      });

      const resultado = await service.login({
        email: 'cliente@sensora.dev',
        senha: 'senhaCorreta123',
      });

      expect(resultado.access_token).toBe('access-token-fake');
      expect(usuariosService.criarRefreshToken).toHaveBeenCalled();
    });
  });

  // Etapa 8.0 (Finalização do e-mail/Resend) — primeira suíte automatizada
  // de forgotPassword()/resetPassword(): a suíte original (Etapa 6.4,
  // comentário no topo deste arquivo) deliberadamente não cobria este
  // fluxo por não fazer parte daquele escopo. Não altera nenhuma regra de
  // negócio existente — só prova o comportamento que já estava implementado
  // (anti-enumeração, expiração, EXPOSE_RESET_TOKEN opt-in). Etapa 8.3
  // (achado HIGH da auditoria — resetToken em texto puro): o teste B abaixo
  // foi atualizado para provar o novo comportamento seguro (hash SHA-256,
  // mesmo mecanismo já usado por emitirTokenVerificacaoEmail) — documentava
  // o texto puro antes desta correção.
  describe('forgotPassword — Etapa 8.0', () => {
    it('A: e-mail inexistente devolve a mesma mensagem genérica, sem persistir token nem enviar e-mail (anti-enumeração)', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce(null);

      const resultado = await service.forgotPassword({
        email: 'nao-existe@sensora.dev',
      });

      expect(resultado.message).toMatch(/receberá instruções/);
      expect(usuariosService.salvarTokenReset).not.toHaveBeenCalled();
      expect(mailService.enviarEmail).not.toHaveBeenCalled();
    });

    // Caso A (Etapa 8.3, fechamento do achado HIGH) — o valor persistido
    // NUNCA é o token em texto puro: é o hash SHA-256 dele, mesmo mecanismo
    // já usado por emitirTokenVerificacaoEmail.
    it('B: e-mail existente persiste só o HASH do token (nunca o token em texto puro) e envia o e-mail de redefinição', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
      });

      await service.forgotPassword({ email: 'cliente@sensora.dev' });

      expect(usuariosService.salvarTokenReset).toHaveBeenCalledTimes(1);
      const [, hashPersistido] =
        usuariosService.salvarTokenReset.mock.calls[0];
      const linkEnviado = (mailService.enviarEmail.mock.calls[0][0] as {
        html: string;
      }).html;
      const tokenNoLink = /token=([0-9a-f]+)/.exec(linkEnviado)?.[1];

      expect(tokenNoLink).toBeDefined();
      // O valor persistido nunca é igual ao token em texto puro enviado no
      // e-mail — é o hash SHA-256 dele (formato: 64 caracteres hex).
      expect(hashPersistido).not.toBe(tokenNoLink);
      expect(hashPersistido).toBe(sha256(tokenNoLink as string));
      expect(hashPersistido).toHaveLength(64);
      expect(mailService.enviarEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'cliente@sensora.dev',
          subject: 'Redefinição de senha — Sensora',
        }),
      );
    });

    it('C: EXPOSE_RESET_TOKEN="true" inclui o token na resposta (fail-safe opt-in, nunca por padrão)', async () => {
      configValues.EXPOSE_RESET_TOKEN = 'true';
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
      });

      const resultado = await service.forgotPassword({
        email: 'cliente@sensora.dev',
      });

      expect(resultado).toHaveProperty('token');
      expect(typeof (resultado as { token?: string }).token).toBe('string');
    });

    it('D: sem EXPOSE_RESET_TOKEN configurado, a resposta nunca inclui o token (padrão seguro)', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
      });

      const resultado = await service.forgotPassword({
        email: 'cliente@sensora.dev',
      });

      expect(resultado).not.toHaveProperty('token');
    });

    it('E: FRONTEND_URL ausente não impede a persistência do token, só pula o envio do e-mail', async () => {
      delete configValues.FRONTEND_URL;
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
      });

      await service.forgotPassword({ email: 'cliente@sensora.dev' });

      expect(usuariosService.salvarTokenReset).toHaveBeenCalledTimes(1);
      expect(mailService.enviarEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword — Etapa 8.0 / 8.3 (hash, nunca plaintext)', () => {
    it('F: token válido e não expirado redefine a senha e revoga todos os refresh tokens ativos', async () => {
      usuariosService.buscarPorResetToken.mockResolvedValueOnce({
        id: 1,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      });

      const resultado = await service.resetPassword({
        token: 'token-valido',
        novaSenha: 'novaSenhaSegura123',
      });

      expect(usuariosService.redefinirSenha).toHaveBeenCalledWith(
        1,
        'novaSenhaSegura123',
      );
      expect(usuariosService.revogarTodosRefreshTokensAtivos).toHaveBeenCalledWith(1);
      expect(resultado.message).toBe('Senha redefinida com sucesso.');
    });

    // Caso B (Etapa 8.3) — nunca compara o token plaintext diretamente com
    // o banco: o argumento passado para buscarPorResetToken é sempre o hash
    // SHA-256 do token recebido, nunca o token em si.
    it('resetPassword() localiza o usuário pelo HASH do token recebido, nunca pelo token em texto puro', async () => {
      usuariosService.buscarPorResetToken.mockResolvedValueOnce({
        id: 1,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      });

      await service.resetPassword({
        token: 'token-recebido-em-texto-puro',
        novaSenha: 'novaSenhaSegura123',
      });

      expect(usuariosService.buscarPorResetToken).toHaveBeenCalledWith(
        sha256('token-recebido-em-texto-puro'),
      );
      expect(usuariosService.buscarPorResetToken).not.toHaveBeenCalledWith(
        'token-recebido-em-texto-puro',
      );
    });

    it('G: token inexistente é rejeitado, sem alterar senha nem revogar sessões', async () => {
      usuariosService.buscarPorResetToken.mockResolvedValueOnce(null);

      await expect(
        service.resetPassword({ token: 'token-que-nao-existe', novaSenha: 'novaSenhaSegura123' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usuariosService.redefinirSenha).not.toHaveBeenCalled();
      expect(usuariosService.revogarTodosRefreshTokensAtivos).not.toHaveBeenCalled();
    });

    it('H: token expirado é rejeitado, sem alterar senha nem revogar sessões', async () => {
      usuariosService.buscarPorResetToken.mockResolvedValueOnce({
        id: 1,
        resetTokenExpiry: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword({ token: 'token-expirado', novaSenha: 'novaSenhaSegura123' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usuariosService.redefinirSenha).not.toHaveBeenCalled();
      expect(usuariosService.revogarTodosRefreshTokensAtivos).not.toHaveBeenCalled();
    });
  });
});
