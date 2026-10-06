import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
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
// (register/verifyEmail/resendVerification), mais os pontos de integração
// exigidos pela auditoria (nenhuma autenticação automática na confirmação).
// Refresh/logout/forgot-password/reset-password/change-password JÁ
// existentes não são re-testados aqui além do necessário — não são o
// escopo desta etapa e não foram alterados.
//
// Confirmação obrigatória no login (ver describe 'login — confirmação
// obrigatória' abaixo): decisão revertida depois desta etapa original —
// login passou a bloquear emailVerificado:false (testes G/H/I), depois de
// um backfill administrativo confirmando as contas já existentes antes do
// bloqueio entrar em vigor (nenhuma conta pré-existente ficou presa fora
// do sistema).
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
    buscarRefreshTokenPorHash: jest.Mock;
    buscarAtivoPorId: jest.Mock;
    revogarRefreshTokenSeAtivo: jest.Mock;
    findOne: jest.Mock;
    atualizarMeusDados: jest.Mock;
    buscarPorHashEmailPendente: jest.Mock;
    confirmarEmailPendenteSeHashValido: jest.Mock;
    alterarMinhaSenha: jest.Mock;
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
      buscarRefreshTokenPorHash: jest.fn(),
      buscarAtivoPorId: jest.fn(),
      revogarRefreshTokenSeAtivo: jest.fn(),
      findOne: jest.fn(),
      atualizarMeusDados: jest.fn(),
      buscarPorHashEmailPendente: jest.fn(),
      confirmarEmailPendenteSeHashValido: jest.fn(),
      alterarMinhaSenha: jest.fn(),
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
        cpf: '529.982.247-25',
      });

      expect(usuariosService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: 'Cliente Teste',
          email: 'cliente@sensora.dev',
          cpf: '529.982.247-25',
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
        cpf: '529.982.247-25',
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
          // Cadastro continua com o texto de boas-vindas (inalterado).
          html: expect.stringContaining('Obrigado por criar sua conta'),
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
        cpf: '529.982.247-25',
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
        cpf: '529.982.247-25',
      });

      expect(resultado).not.toHaveProperty('access_token');
      expect(resultado).not.toHaveProperty('refresh_token');
      expect(usuariosService.criarRefreshToken).not.toHaveBeenCalled();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('nome com HTML é escapado no e-mail de confirmação', async () => {
      const nomeMalicioso = '<a href="https://mal.example">Clique</a>';
      usuariosService.buscarPorEmail.mockResolvedValueOnce(null);
      usuariosService.create.mockResolvedValueOnce({
        id: 1,
        nome: nomeMalicioso,
        email: 'cliente@sensora.dev',
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
        emailVerificado: false,
      });

      await service.register({
        nome: nomeMalicioso,
        email: 'cliente@sensora.dev',
        senha: 'senhaSegura123',
        cpf: '529.982.247-25',
      });

      const [{ html }] = mailService.enviarEmail.mock.calls[0] as [
        { html: string },
      ];
      expect(html).not.toContain('<a href="https://mal.example">');
      expect(html).toContain(
        'Olá, &lt;a href=&quot;https://mal.example&quot;&gt;Clique&lt;/a&gt;.',
      );
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

  describe('atualizarMeusDados — troca de e-mail fica pendente até a confirmação', () => {
    const atual = {
      id: 7,
      nome: 'Cliente',
      email: 'cliente@sensora.dev',
      perfil: PerfilUsuario.CLIENTE,
      ativo: true,
      emailVerificado: true,
      emailPendente: null,
    };
    const VALIDADE_VERIFICACAO_MS = 48 * 60 * 60 * 1000;

    // Conta completa (com hash da senha) devolvida por buscarPorEmail.
    function conta(
      emailPendenteExpiraEm: Date | null = null,
      emailVerificationExpiry: Date | null = null,
    ) {
      return {
        ...atual,
        senha: SENHA_HASH_TESTE,
        emailVerificationExpiry,
        emailPendenteExpiraEm,
      };
    }

    function prepararTroca(contaAtual = conta()) {
      usuariosService.findOne.mockResolvedValueOnce(atual);
      usuariosService.buscarPorEmail.mockResolvedValueOnce(contaAtual);
      usuariosService.atualizarMeusDados.mockResolvedValueOnce({
        ...atual,
        emailPendente: 'novo@gmail.com',
      });
    }

    function trocar(senhaAtual?: string) {
      return service.atualizarMeusDados(7, {
        nome: 'Cliente',
        email: 'NOVO@GMAIL.COM',
        senhaAtual,
      });
    }

    function emailPara(destinatario: string) {
      const chamada = mailService.enviarEmail.mock.calls.find(
        ([params]) => (params as { to: string }).to === destinatario,
      ) as [{ to: string; subject: string; html: string }] | undefined;
      return chamada?.[0];
    }

    function nadaAconteceu() {
      expect(usuariosService.atualizarMeusDados).not.toHaveBeenCalled();
      expect(
        usuariosService.revogarTodosRefreshTokensAtivos,
      ).not.toHaveBeenCalled();
      expect(mailService.enviarEmail).not.toHaveBeenCalled();
    }

    it('e-mail igual (mesmo com outra caixa/espaços): só repassa, sem senha, token nem e-mail', async () => {
      usuariosService.findOne.mockResolvedValueOnce(atual);
      usuariosService.atualizarMeusDados.mockResolvedValueOnce(atual);

      await service.atualizarMeusDados(7, {
        nome: 'Cliente',
        email: ' CLIENTE@Sensora.dev ',
      });

      expect(usuariosService.atualizarMeusDados).toHaveBeenCalledWith(7, {
        nome: 'Cliente',
        email: ' CLIENTE@Sensora.dev ',
      });
      expect(usuariosService.buscarPorEmail).not.toHaveBeenCalled();
      expect(
        usuariosService.revogarTodosRefreshTokensAtivos,
      ).not.toHaveBeenCalled();
      expect(mailService.enviarEmail).not.toHaveBeenCalled();
    });

    it('só nome/CPF/telefone mudando (mesmo e-mail): não exige senha', async () => {
      usuariosService.findOne.mockResolvedValueOnce(atual);
      usuariosService.atualizarMeusDados.mockResolvedValueOnce(atual);

      await service.atualizarMeusDados(7, {
        nome: 'Outro Nome',
        email: 'cliente@sensora.dev',
        cpf: '529.982.247-25',
        telefone: '(41) 99999-9999',
      });

      expect(usuariosService.atualizarMeusDados).toHaveBeenCalledTimes(1);
      expect(usuariosService.buscarPorEmail).not.toHaveBeenCalled();
      expect(mailService.enviarEmail).not.toHaveBeenCalled();
    });

    it('troca sem senhaAtual é rejeitada (400), sem gravar, gerar token, revogar sessões nem enviar e-mail', async () => {
      prepararTroca();

      await expect(trocar()).rejects.toThrow(
        new BadRequestException('Senha atual incorreta.'),
      );
      nadaAconteceu();
    });

    it('senha atual incorreta é rejeitada com a mesma mensagem e status 400 (nunca 401), sem alterar nada', async () => {
      prepararTroca();

      const erro = await trocar('senhaErrada').catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(BadRequestException);
      expect((erro as BadRequestException).getStatus()).toBe(400);
      expect((erro as BadRequestException).message).toBe(
        'Senha atual incorreta.',
      );
      nadaAconteceu();
    });

    it('senha correta: grava só a troca pendente (hash do token, validade de 48h); e-mail oficial e verificação não mudam', async () => {
      prepararTroca();

      const resultado = await trocar('senhaCorreta123');

      expect(resultado.email).toBe('cliente@sensora.dev');
      expect(resultado.emailVerificado).toBe(true);
      expect(resultado.emailPendente).toBe('novo@gmail.com');

      const [, , pendente] = usuariosService.atualizarMeusDados.mock
        .calls[0] as [
        number,
        unknown,
        { emailPendenteTokenHash: string; emailPendenteExpiraEm: Date },
      ];
      expect(pendente.emailPendenteTokenHash).toMatch(/^[a-f0-9]{64}$/);
      const validade = pendente.emailPendenteExpiraEm.getTime() - Date.now();
      expect(validade).toBeGreaterThan(VALIDADE_VERIFICACAO_MS - 5000);
      expect(validade).toBeLessThanOrEqual(VALIDADE_VERIFICACAO_MS);

      // O link vai SÓ para o endereço pendente; o banco recebe só o hash.
      const confirmacao = emailPara('novo@gmail.com');
      expect(confirmacao).toBeDefined();
      expect(confirmacao!.html).toContain('Foi solicitada a troca');
      expect(confirmacao!.html).not.toContain('Obrigado por criar sua conta');
      const token = /token=([a-f0-9]+)/.exec(confirmacao!.html)?.[1];
      expect(token).toBeDefined();
      expect(token).not.toBe(pendente.emailPendenteTokenHash);
      expect(sha256(token as string)).toBe(pendente.emailPendenteTokenHash);
    });

    it('senha correta: avisa o e-mail ATUAL que a troca está pendente, sem token nem link, com o novo mascarado', async () => {
      prepararTroca();

      await trocar('senhaCorreta123');

      expect(mailService.enviarEmail).toHaveBeenCalledTimes(2);
      const aviso = emailPara('cliente@sensora.dev');
      expect(aviso).toBeDefined();
      expect(aviso!.subject).toBe('Alteração de e-mail solicitada — Sensora');
      expect(aviso!.html).toContain('no***@gmail.com');
      expect(aviso!.html).toContain('fica pendente até ser confirmado');
      expect(aviso!.html).toContain('continua sendo o e-mail da sua conta');
      expect(aviso!.html).not.toContain('novo@gmail.com');
      expect(aviso!.html).not.toContain('token=');
      expect(aviso!.html).not.toContain('href');
      expect(aviso!.html).toContain('suporte da Sensora');
    });

    it('aviso ao e-mail atual escapa HTML do nome', async () => {
      usuariosService.findOne.mockResolvedValueOnce({
        ...atual,
        nome: '<a href="https://mal.example">Clique</a>',
      });
      usuariosService.buscarPorEmail.mockResolvedValueOnce(conta());
      usuariosService.atualizarMeusDados.mockResolvedValueOnce({
        ...atual,
        emailPendente: 'novo@gmail.com',
      });

      await trocar('senhaCorreta123');

      const aviso = emailPara('cliente@sensora.dev');
      expect(aviso!.html).not.toContain('<a href');
      expect(aviso!.html).toContain(
        'Olá, &lt;a href=&quot;https://mal.example&quot;&gt;Clique&lt;/a&gt;.',
      );
    });

    it('falha no envio do aviso ao e-mail atual não desfaz a troca pendente', async () => {
      prepararTroca();
      mailService.enviarEmail.mockImplementation(({ to }: { to: string }) =>
        to === 'cliente@sensora.dev'
          ? Promise.reject(new Error('Resend fora'))
          : Promise.resolve(),
      );
      const erroLog = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      const resultado = await trocar('senhaCorreta123');

      expect(resultado.emailPendente).toBe('novo@gmail.com');
      expect(usuariosService.atualizarMeusDados).toHaveBeenCalledTimes(1);
      expect(erroLog).toHaveBeenCalledWith(
        'Falha ao avisar o e-mail antigo sobre a troca de e-mail da conta.',
        expect.any(String),
      );
      erroLog.mockRestore();
    });

    it('e-mail oficial de outra conta continua 409, sem revogar sessões nem enviar e-mails', async () => {
      usuariosService.findOne.mockResolvedValueOnce(atual);
      usuariosService.buscarPorEmail.mockResolvedValueOnce(conta());
      usuariosService.atualizarMeusDados.mockRejectedValueOnce(
        new ConflictException('Este e-mail já está em uso por outra conta.'),
      );

      await expect(trocar('senhaCorreta123')).rejects.toThrow(
        ConflictException,
      );
      expect(
        usuariosService.revogarTodosRefreshTokensAtivos,
      ).not.toHaveBeenCalled();
      expect(mailService.enviarEmail).not.toHaveBeenCalled();
    });

    it('segunda troca dentro do cooldown (troca pendente pedida há 10s) é rejeitada (429), sem gravar, revogar nem enviar e-mails', async () => {
      prepararTroca(
        conta(new Date(Date.now() + VALIDADE_VERIFICACAO_MS - 10_000)),
      );

      const erro = await trocar('senhaCorreta123').catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(HttpException);
      expect((erro as HttpException).getStatus()).toBe(429);
      nadaAconteceu();
    });

    it('troca depois do cooldown (troca pendente pedida há 61s) funciona', async () => {
      prepararTroca(
        conta(new Date(Date.now() + VALIDADE_VERIFICACAO_MS - 61_000)),
      );

      const resultado = await trocar('senhaCorreta123');

      expect(resultado.emailPendente).toBe('novo@gmail.com');
      expect(usuariosService.atualizarMeusDados).toHaveBeenCalledTimes(1);
      expect(mailService.enviarEmail).toHaveBeenCalledTimes(2);
    });

    it('cadastro/reenvio de confirmação recente (emailVerificationExpiry de 10s atrás) não bloqueia a troca', async () => {
      prepararTroca(
        conta(null, new Date(Date.now() + VALIDADE_VERIFICACAO_MS - 10_000)),
      );

      const resultado = await trocar('senhaCorreta123');

      expect(resultado.emailPendente).toBe('novo@gmail.com');
      expect(usuariosService.atualizarMeusDados).toHaveBeenCalledTimes(1);
    });

    it('troca aceita revoga os refresh tokens ativos do usuário, depois da gravação', async () => {
      prepararTroca();

      await trocar('senhaCorreta123');

      expect(
        usuariosService.revogarTodosRefreshTokensAtivos,
      ).toHaveBeenCalledWith(7);
      const ordemGravacao =
        usuariosService.atualizarMeusDados.mock.invocationCallOrder[0];
      const ordemRevogacao =
        usuariosService.revogarTodosRefreshTokensAtivos.mock
          .invocationCallOrder[0];
      expect(ordemRevogacao).toBeGreaterThan(ordemGravacao);
    });
  });

  // MÉDIO-3 — ciclo completo com um "banco" em memória: pedido da troca,
  // confirmação pelo link (fluxo B do verifyEmail) e efeitos em login,
  // forgot-password e resend-verification enquanto a troca está pendente.
  describe('troca de e-mail pendente — confirmação e demais fluxos (MÉDIO-3)', () => {
    let estado: {
      email: string;
      emailVerificado: boolean;
      emailPendente: string | null;
      emailPendenteTokenHash: string | null;
      emailPendenteExpiraEm: Date | null;
    };

    function contaCompleta() {
      return {
        id: 7,
        nome: 'Cliente',
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
        senha: SENHA_HASH_TESTE,
        emailVerificationExpiry: null,
        ...estado,
      };
    }

    beforeEach(() => {
      estado = {
        email: 'a@sensora.dev',
        emailVerificado: true,
        emailPendente: null,
        emailPendenteTokenHash: null,
        emailPendenteExpiraEm: null,
      };
      usuariosService.findOne.mockImplementation(() => ({
        ...contaCompleta(),
      }));
      // Igual ao real: procura só pelo e-mail oficial.
      usuariosService.buscarPorEmail.mockImplementation((email: string) =>
        email.trim().toLowerCase() === estado.email ? contaCompleta() : null,
      );
      usuariosService.atualizarMeusDados.mockImplementation(
        (
          _id: number,
          dto: { email: string },
          pendente?: {
            emailPendenteTokenHash: string;
            emailPendenteExpiraEm: Date;
          },
        ) => {
          const email = dto.email.trim().toLowerCase();
          if (email !== estado.email && pendente) {
            estado.emailPendente = email;
            estado.emailPendenteTokenHash = pendente.emailPendenteTokenHash;
            estado.emailPendenteExpiraEm = pendente.emailPendenteExpiraEm;
          }
          return contaCompleta();
        },
      );
      usuariosService.buscarPorHashVerificacaoEmail.mockResolvedValue(null);
      usuariosService.buscarPorHashEmailPendente.mockImplementation(
        (hash: string) =>
          hash === estado.emailPendenteTokenHash
            ? {
                id: 7,
                emailPendente: estado.emailPendente,
                emailPendenteExpiraEm: estado.emailPendenteExpiraEm,
              }
            : null,
      );
      usuariosService.confirmarEmailPendenteSeHashValido.mockImplementation(
        (_id: number, hash: string, novoEmail: string) => {
          if (hash !== estado.emailPendenteTokenHash) return 0;
          estado.email = novoEmail;
          estado.emailVerificado = true;
          estado.emailPendente = null;
          estado.emailPendenteTokenHash = null;
          estado.emailPendenteExpiraEm = null;
          return 1;
        },
      );
    });

    async function pedirTroca(novoEmail: string): Promise<string> {
      mailService.enviarEmail.mockClear();
      await service.atualizarMeusDados(7, {
        nome: 'Cliente',
        email: novoEmail,
        senhaAtual: 'senhaCorreta123',
      });
      const confirmacao = mailService.enviarEmail.mock.calls
        .map(([params]) => params as { to: string; html: string })
        .find((params) => params.to === novoEmail);
      return /token=([a-f0-9]+)/.exec(confirmacao!.html)![1];
    }

    // Simula a passagem do tempo para sair do cooldown de 60s.
    function passarCooldown() {
      estado.emailPendenteExpiraEm = new Date(
        estado.emailPendenteExpiraEm!.getTime() - 61_000,
      );
    }

    it('confirmação válida promove o pendente a e-mail oficial e limpa a troca', async () => {
      const token = await pedirTroca('b@sensora.dev');
      expect(estado.email).toBe('a@sensora.dev');
      expect(estado.emailPendente).toBe('b@sensora.dev');

      const resposta = await service.verifyEmail({ token });

      expect(resposta.message).toBe('E-mail confirmado com sucesso.');
      expect(
        usuariosService.confirmarEmailPendenteSeHashValido,
      ).toHaveBeenCalledWith(7, sha256(token), 'b@sensora.dev');
      expect(estado).toMatchObject({
        email: 'b@sensora.dev',
        emailVerificado: true,
        emailPendente: null,
        emailPendenteTokenHash: null,
        emailPendenteExpiraEm: null,
      });
      // Confirmar não cria sessão.
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(usuariosService.criarRefreshToken).not.toHaveBeenCalled();
    });

    it('A → B e depois A → C: o token de B deixa de valer e o de C efetiva a troca', async () => {
      const tokenB = await pedirTroca('b@sensora.dev');
      passarCooldown();
      const tokenC = await pedirTroca('c@sensora.dev');

      await expect(service.verifyEmail({ token: tokenB })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(estado.email).toBe('a@sensora.dev');

      await service.verifyEmail({ token: tokenC });
      expect(estado.email).toBe('c@sensora.dev');
    });

    it('A → B e logo em seguida A → C (dentro do cooldown): 429 e B continua pendente', async () => {
      await pedirTroca('b@sensora.dev');

      await expect(pedirTroca('c@sensora.dev')).rejects.toMatchObject({
        status: 429,
      });
      expect(estado.emailPendente).toBe('b@sensora.dev');
    });

    it('enviar o mesmo e-mail atual com a troca pendente não cancela o pendente', async () => {
      const token = await pedirTroca('b@sensora.dev');

      await service.atualizarMeusDados(7, {
        nome: 'Outro Nome',
        email: 'a@sensora.dev',
      });

      expect(estado.emailPendente).toBe('b@sensora.dev');
      await service.verifyEmail({ token });
      expect(estado.email).toBe('b@sensora.dev');
    });

    it('token expirado é rejeitado sem efetivar a troca', async () => {
      const token = await pedirTroca('b@sensora.dev');
      estado.emailPendenteExpiraEm = new Date(Date.now() - 1000);

      await expect(service.verifyEmail({ token })).rejects.toThrow(
        new UnauthorizedException('Token inválido ou expirado'),
      );
      expect(
        usuariosService.confirmarEmailPendenteSeHashValido,
      ).not.toHaveBeenCalled();
      expect(estado.email).toBe('a@sensora.dev');
    });

    it('token inválido (nem de cadastro nem de troca) é rejeitado', async () => {
      await expect(
        service.verifyEmail({ token: 'token-que-nao-existe' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(
        usuariosService.confirmarEmailPendenteSeHashValido,
      ).not.toHaveBeenCalled();
    });

    it('confirmação concorrente perdida (count 0) responde "já confirmado" sem efetivar de novo', async () => {
      const token = await pedirTroca('b@sensora.dev');
      usuariosService.confirmarEmailPendenteSeHashValido.mockResolvedValueOnce(
        0,
      );

      const resposta = await service.verifyEmail({ token });

      expect(resposta.message).toBe('Este e-mail já foi confirmado.');
      expect(estado.email).toBe('a@sensora.dev');
    });

    it('P2002 na confirmação (endereço já em uso por outra conta) chega como 409', async () => {
      const token = await pedirTroca('b@sensora.dev');
      usuariosService.confirmarEmailPendenteSeHashValido.mockRejectedValueOnce(
        new ConflictException('Este e-mail já está em uso por outra conta.'),
      );

      await expect(service.verifyEmail({ token })).rejects.toThrow(
        ConflictException,
      );
    });

    it('conta antiga em transição (troca antes do MÉDIO-3) ainda confirma por emailVerificationHash', async () => {
      usuariosService.buscarPorHashVerificacaoEmail.mockResolvedValueOnce({
        id: 9,
        nome: 'Conta Antiga',
        email: 'novo-antigo@sensora.dev',
        emailVerificado: false,
        emailVerificationExpiry: new Date(Date.now() + 60 * 60 * 1000),
      });
      usuariosService.confirmarEmailSeHashValido.mockResolvedValueOnce(1);

      const resposta = await service.verifyEmail({ token: 'token-antigo' });

      expect(resposta.message).toBe('E-mail confirmado com sucesso.');
      expect(usuariosService.confirmarEmailSeHashValido).toHaveBeenCalledWith(
        9,
        sha256('token-antigo'),
      );
      expect(usuariosService.buscarPorHashEmailPendente).not.toHaveBeenCalled();
    });

    it('login com o e-mail atual funciona durante a troca pendente', async () => {
      await pedirTroca('b@sensora.dev');

      const resultado = await service.login({
        email: 'a@sensora.dev',
        senha: 'senhaCorreta123',
      });

      expect(resultado.access_token).toBe('access-token-fake');
    });

    it('login com o e-mail pendente falha como credencial inválida', async () => {
      await pedirTroca('b@sensora.dev');

      await expect(
        service.login({ email: 'b@sensora.dev', senha: 'senhaCorreta123' }),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('forgot-password pelo e-mail atual manda o reset para o atual', async () => {
      await pedirTroca('b@sensora.dev');
      mailService.enviarEmail.mockClear();

      await service.forgotPassword({ email: 'a@sensora.dev' });

      expect(mailService.enviarEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@sensora.dev',
          subject: 'Redefinição de senha — Sensora',
        }),
      );
    });

    it('forgot-password pelo e-mail pendente não encontra a conta (resposta genérica, sem e-mail)', async () => {
      await pedirTroca('b@sensora.dev');
      mailService.enviarEmail.mockClear();

      const resposta = await service.forgotPassword({ email: 'b@sensora.dev' });

      expect(resposta.message).toContain('Se existir uma conta');
      expect(usuariosService.salvarTokenReset).not.toHaveBeenCalled();
      expect(mailService.enviarEmail).not.toHaveBeenCalled();
    });

    it('resend-verification não envia nada para conta verificada com troca pendente (nem ao atual, nem ao pendente)', async () => {
      await pedirTroca('b@sensora.dev');
      mailService.enviarEmail.mockClear();

      const atualResp = await service.resendVerification({
        email: 'a@sensora.dev',
      });
      const pendenteResp = await service.resendVerification({
        email: 'b@sensora.dev',
      });

      expect(atualResp.message).toBe(pendenteResp.message);
      expect(
        usuariosService.emitirTokenVerificacaoEmail,
      ).not.toHaveBeenCalled();
      expect(mailService.enviarEmail).not.toHaveBeenCalled();
      expect(estado.emailPendente).toBe('b@sensora.dev');
    });
  });

  describe('login — confirmação obrigatória', () => {
    // G
    it('G: login funciona normalmente para uma conta com e-mail confirmado', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        senha: SENHA_HASH_TESTE,
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
        emailVerificado: true,
      });

      const resultado = await service.login({
        email: 'cliente@sensora.dev',
        senha: 'senhaCorreta123',
      });

      expect(resultado.access_token).toBe('access-token-fake');
      expect(usuariosService.criarRefreshToken).toHaveBeenCalled();
    });

    // H
    it('H: login é bloqueado (403, code EMAIL_NAO_VERIFICADO) para uma conta com e-mail ainda não confirmado, sem emitir tokens', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        senha: SENHA_HASH_TESTE,
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
        emailVerificado: false,
      });

      await expect(
        service.login({
          email: 'cliente@sensora.dev',
          senha: 'senhaCorreta123',
        }),
      ).rejects.toMatchObject({
        constructor: ForbiddenException,
        response: { code: 'EMAIL_NAO_VERIFICADO' },
      });
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(usuariosService.criarRefreshToken).not.toHaveBeenCalled();
    });

    // I
    it('I: senha incorreta continua rejeitada com "Credenciais inválidas" ANTES de checar emailVerificado — checagem de senha tem prioridade, não revela status de confirmação para quem não provou conhecer a senha', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        senha: SENHA_HASH_TESTE,
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
        emailVerificado: false,
      });

      await expect(
        service.login({
          email: 'cliente@sensora.dev',
          senha: 'senhaErrada',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  // Vistoria de proteção de dados — login de e-mail inexistente e de conta
  // desativada.
  describe('login — e-mail inexistente e conta desativada', () => {
    // O namespace importado não aceita spy; o módulo real (o mesmo que o
    // AuthService usa) aceita.
    const bcryptReal = jest.requireActual<typeof bcrypt>('bcrypt');

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('e-mail inexistente: roda bcrypt.compare contra um hash fixo e responde "Credenciais inválidas", sem criar tokens', async () => {
      const compare = jest.spyOn(bcryptReal, 'compare');
      usuariosService.buscarPorEmail.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'ninguem@sensora.dev', senha: 'qualquer123' }),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));

      expect(compare).toHaveBeenCalledTimes(1);
      const [senhaComparada, hashUsado] = compare.mock.calls[0];
      expect(senhaComparada).toBe('qualquer123');
      expect(bcrypt.getRounds(hashUsado)).toBe(10);
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(usuariosService.criarRefreshToken).not.toHaveBeenCalled();
    });

    it('e-mail inexistente: o hash fixo é sempre o mesmo (não é gerado a cada tentativa)', async () => {
      const compare = jest.spyOn(bcryptReal, 'compare');
      usuariosService.buscarPorEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'a@sensora.dev', senha: 'qualquer123' }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login({ email: 'b@sensora.dev', senha: 'outra12345' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(compare.mock.calls[0][1]).toBe(compare.mock.calls[1][1]);
    });

    it('conta desativada com a senha correta: mesma mensagem genérica, sem tokens nem RefreshToken', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        senha: SENHA_HASH_TESTE,
        perfil: PerfilUsuario.CLIENTE,
        ativo: false,
        emailVerificado: true,
      });

      await expect(
        service.login({
          email: 'cliente@sensora.dev',
          senha: 'senhaCorreta123',
        }),
      ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));

      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(usuariosService.criarRefreshToken).not.toHaveBeenCalled();
    });

    it('conta desativada recebe exatamente a mesma resposta de uma senha errada', async () => {
      const usuario = {
        id: 1,
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        senha: SENHA_HASH_TESTE,
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
        emailVerificado: true,
      };
      usuariosService.buscarPorEmail
        .mockResolvedValueOnce(usuario)
        .mockResolvedValueOnce({ ...usuario, ativo: false });

      const senhaErrada = await service
        .login({ email: 'cliente@sensora.dev', senha: 'senhaErrada' })
        .catch((erro: UnauthorizedException) => erro);
      const desativada = await service
        .login({ email: 'cliente@sensora.dev', senha: 'senhaCorreta123' })
        .catch((erro: UnauthorizedException) => erro);

      expect(desativada).toBeInstanceOf(UnauthorizedException);
      expect((desativada as UnauthorizedException).getResponse()).toEqual(
        (senhaErrada as UnauthorizedException).getResponse(),
      );
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

    it('nome com HTML é escapado no e-mail de redefinição de senha', async () => {
      usuariosService.buscarPorEmail.mockResolvedValueOnce({
        id: 1,
        nome: '<img src=x onerror=alert(1)>',
        email: 'cliente@sensora.dev',
      });

      await service.forgotPassword({ email: 'cliente@sensora.dev' });

      const [{ html }] = mailService.enviarEmail.mock.calls[0] as [
        { html: string },
      ];
      expect(html).not.toContain('<img');
      expect(html).toContain('Olá, &lt;img src=x onerror=alert(1)&gt;.');
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

  // MÉDIO-4 — aviso de segurança por e-mail depois de a senha ser alterada,
  // nos dois fluxos (troca em Minha Conta e redefinição por token).
  describe('aviso de senha alterada (MÉDIO-4)', () => {
    const USUARIO = { id: 1, nome: 'Ana', email: 'ana@sensora.dev' };
    const DTO_TROCA = {
      senhaAtual: 'senhaAtual123',
      novaSenha: 'novaSenhaSegura123',
    };

    function emailEnviado() {
      expect(mailService.enviarEmail).toHaveBeenCalledTimes(1);
      const [[email]] = mailService.enviarEmail.mock.calls as [
        [{ to: string; subject: string; html: string }],
      ];
      return email;
    }

    function tokenValido() {
      usuariosService.buscarPorResetToken.mockResolvedValueOnce({
        ...USUARIO,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      });
    }

    describe('troca autenticada (changePassword)', () => {
      it('sucesso: envia exatamente 1 aviso, ao e-mail atual, com o assunto certo', async () => {
        usuariosService.findOne.mockResolvedValueOnce(USUARIO);

        const resultado = await service.changePassword(1, DTO_TROCA);

        expect(resultado.message).toBe('Senha alterada com sucesso.');
        const email = emailEnviado();
        expect(email.to).toBe('ana@sensora.dev');
        expect(email.subject).toBe('Senha alterada — Sensora');
        expect(email.html).toContain('foi alterada em');
        expect(email.html).toContain('http://localhost:3002/forgot-password');
      });

      it('o aviso é enviado depois da troca, nunca antes', async () => {
        usuariosService.findOne.mockResolvedValueOnce(USUARIO);

        await service.changePassword(1, DTO_TROCA);

        expect(
          usuariosService.alterarMinhaSenha.mock.invocationCallOrder[0],
        ).toBeLessThan(mailService.enviarEmail.mock.invocationCallOrder[0]);
      });

      it('nome com HTML é escapado', async () => {
        usuariosService.findOne.mockResolvedValueOnce({
          ...USUARIO,
          nome: '<script>alert(1)</script>',
        });

        await service.changePassword(1, DTO_TROCA);

        const { html } = emailEnviado();
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
      });

      it('o e-mail não contém senha, token, hash nem JWT', async () => {
        usuariosService.findOne.mockResolvedValueOnce(USUARIO);

        await service.changePassword(1, DTO_TROCA);

        const { html } = emailEnviado();
        expect(html).not.toContain(DTO_TROCA.senhaAtual);
        expect(html).not.toContain(DTO_TROCA.novaSenha);
        expect(html).not.toContain('token');
        expect(html).not.toContain('access-token-fake');
        expect(html).not.toContain('$2b$');
      });

      it('senha atual incorreta: não envia aviso', async () => {
        usuariosService.alterarMinhaSenha.mockRejectedValueOnce(
          new UnauthorizedException('Senha atual incorreta.'),
        );

        await expect(service.changePassword(1, DTO_TROCA)).rejects.toThrow(
          UnauthorizedException,
        );
        expect(mailService.enviarEmail).not.toHaveBeenCalled();
      });

      it('falha na atualização: não envia aviso', async () => {
        usuariosService.alterarMinhaSenha.mockRejectedValueOnce(
          new Error('falha no banco'),
        );

        await expect(service.changePassword(1, DTO_TROCA)).rejects.toThrow(
          'falha no banco',
        );
        expect(mailService.enviarEmail).not.toHaveBeenCalled();
      });

      it('falha no envio do e-mail: a troca continua bem-sucedida', async () => {
        usuariosService.findOne.mockResolvedValueOnce(USUARIO);
        mailService.enviarEmail.mockRejectedValueOnce(new Error('Resend fora'));

        const resultado = await service.changePassword(1, DTO_TROCA);

        expect(resultado.message).toBe('Senha alterada com sucesso.');
        expect(usuariosService.alterarMinhaSenha).toHaveBeenCalledWith(
          1,
          DTO_TROCA.senhaAtual,
          DTO_TROCA.novaSenha,
        );
      });
    });

    describe('redefinição (resetPassword)', () => {
      it('sucesso: envia exatamente 1 aviso, ao e-mail atual, e mantém revogação das sessões', async () => {
        tokenValido();
        usuariosService.findOne.mockResolvedValueOnce(USUARIO);

        const resultado = await service.resetPassword({
          token: 'token-valido',
          novaSenha: 'novaSenhaSegura123',
        });

        expect(resultado.message).toBe('Senha redefinida com sucesso.');
        const email = emailEnviado();
        expect(email.to).toBe('ana@sensora.dev');
        expect(email.subject).toBe('Senha alterada — Sensora');
        expect(usuariosService.redefinirSenha).toHaveBeenCalledWith(
          1,
          'novaSenhaSegura123',
        );
        expect(
          usuariosService.revogarTodosRefreshTokensAtivos,
        ).toHaveBeenCalledWith(1);
        expect(
          usuariosService.redefinirSenha.mock.invocationCallOrder[0],
        ).toBeLessThan(mailService.enviarEmail.mock.invocationCallOrder[0]);
      });

      it('nome com HTML é escapado', async () => {
        tokenValido();
        usuariosService.findOne.mockResolvedValueOnce({
          ...USUARIO,
          nome: '<b>Ana</b>',
        });

        await service.resetPassword({
          token: 'token-valido',
          novaSenha: 'novaSenhaSegura123',
        });

        const { html } = emailEnviado();
        expect(html).not.toContain('<b>Ana</b>');
        expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
      });

      it('o e-mail não contém o token de recuperação, seu hash nem a senha nova', async () => {
        tokenValido();
        usuariosService.findOne.mockResolvedValueOnce(USUARIO);

        await service.resetPassword({
          token: 'token-de-recuperacao-secreto',
          novaSenha: 'novaSenhaSegura123',
        });

        const { html } = emailEnviado();
        expect(html).not.toContain('token-de-recuperacao-secreto');
        expect(html).not.toContain(sha256('token-de-recuperacao-secreto'));
        expect(html).not.toContain('novaSenhaSegura123');
        expect(html).not.toContain('reset-password');
      });

      it('token inválido: não envia aviso', async () => {
        usuariosService.buscarPorResetToken.mockResolvedValueOnce(null);

        await expect(
          service.resetPassword({
            token: 'nao-existe',
            novaSenha: 'novaSenhaSegura123',
          }),
        ).rejects.toThrow(UnauthorizedException);
        expect(mailService.enviarEmail).not.toHaveBeenCalled();
      });

      it('token expirado: não envia aviso', async () => {
        usuariosService.buscarPorResetToken.mockResolvedValueOnce({
          ...USUARIO,
          resetTokenExpiry: new Date(Date.now() - 1000),
        });

        await expect(
          service.resetPassword({
            token: 'expirado',
            novaSenha: 'novaSenhaSegura123',
          }),
        ).rejects.toThrow(UnauthorizedException);
        expect(mailService.enviarEmail).not.toHaveBeenCalled();
      });

      it('falha no envio do e-mail: a redefinição continua bem-sucedida', async () => {
        tokenValido();
        usuariosService.findOne.mockResolvedValueOnce(USUARIO);
        mailService.enviarEmail.mockRejectedValueOnce(new Error('Resend fora'));

        const resultado = await service.resetPassword({
          token: 'token-valido',
          novaSenha: 'novaSenhaSegura123',
        });

        expect(resultado.message).toBe('Senha redefinida com sucesso.');
        expect(
          usuariosService.revogarTodosRefreshTokensAtivos,
        ).toHaveBeenCalledWith(1);
      });
    });
  });

  // Etapa 10 / AUTH-04 (achado da auditoria — reuso de refresh token sem
  // revogação em cascata). Cenários pedidos pela correção: (1) refresh
  // normal não aciona a cascata; (2) reuso de um token já revogado aciona
  // revogarTodosRefreshTokensAtivos() e rejeita; (3) a chamada de cascata é
  // exatamente o mecanismo que revoga "B e C" (qualquer token ativo do
  // usuário, não só o token reapresentado — prova detalhada em
  // usuarios.service.spec.ts, já que revogarTodosRefreshTokensAtivos() não
  // filtra por token nenhum); (4) o usuarioId usado na cascata é sempre o
  // do REGISTRO do token reutilizado, nunca um valor arbitrário.
  describe('refresh — Etapa 10 / AUTH-04 (revogação em cascata no reuso)', () => {
    const USUARIO_ATIVO = {
      id: 1,
      email: 'cliente@sensora.dev',
      perfil: PerfilUsuario.CLIENTE,
      ativo: true,
    };

    // Cenário 1 — refresh normal.
    it('A: token A válido (não revogado, não expirado) é aceito — A é revogado, B é criado, cascata NÃO é acionada', async () => {
      usuariosService.buscarRefreshTokenPorHash.mockResolvedValueOnce({
        id: 10,
        usuarioId: 1,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: null,
      });
      usuariosService.buscarAtivoPorId.mockResolvedValueOnce(USUARIO_ATIVO);
      usuariosService.revogarRefreshTokenSeAtivo.mockResolvedValueOnce(1);

      const resultado = await service.refresh({ refresh_token: 'token-A' });

      expect(usuariosService.buscarRefreshTokenPorHash).toHaveBeenCalledWith(
        sha256('token-A'),
      );
      expect(usuariosService.revogarRefreshTokenSeAtivo).toHaveBeenCalledWith(
        sha256('token-A'),
      );
      expect(usuariosService.criarRefreshToken).toHaveBeenCalledTimes(1);
      expect(usuariosService.criarRefreshToken.mock.calls[0][0]).toBe(1);
      expect(usuariosService.revogarTodosRefreshTokensAtivos).not.toHaveBeenCalled();
      expect(resultado.access_token).toBe('access-token-fake');
      expect(typeof resultado.refresh_token).toBe('string');
    });

    // Cenário 2 — reutilização de A.
    it('B: token A já revogado (reuso) é rejeitado — revogarTodosRefreshTokensAtivos(usuarioId) é chamado ANTES da exceção, nenhum novo par de tokens é emitido', async () => {
      usuariosService.buscarRefreshTokenPorHash.mockResolvedValueOnce({
        id: 10,
        usuarioId: 1,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: new Date(Date.now() - 5000), // já usado antes
      });

      await expect(
        service.refresh({ refresh_token: 'token-A-ja-usado' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(usuariosService.revogarTodosRefreshTokensAtivos).toHaveBeenCalledWith(1);
      expect(usuariosService.revogarTodosRefreshTokensAtivos).toHaveBeenCalledTimes(1);
      // A rejeição usa o caminho de reuso, não o de rotação normal — nunca
      // tenta revogar/rotacionar o próprio token A de novo nem emitir B.
      expect(usuariosService.revogarRefreshTokenSeAtivo).not.toHaveBeenCalled();
      expect(usuariosService.criarRefreshToken).not.toHaveBeenCalled();
      expect(usuariosService.buscarAtivoPorId).not.toHaveBeenCalled();
    });

    // Cenário 3 — contenção (B e C deixam de ser válidos). A prova de que a
    // chamada abaixo de fato invalida QUALQUER token ativo do usuário (não
    // só o token A que disparou a detecção) está em
    // usuarios.service.spec.ts — aqui provamos que AuthService.refresh()
    // delega para exatamente esse mecanismo, com o usuarioId correto.
    it('C: reuso de A aciona a revogação de TODAS as sessões do usuário (mecanismo que também invalida B e C, não só A)', async () => {
      usuariosService.buscarRefreshTokenPorHash.mockResolvedValueOnce({
        id: 10,
        usuarioId: 1,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: new Date(Date.now() - 5000),
      });
      // Representa B e C (dois outros tokens ativos) tendo sido revogados
      // pela mesma chamada, junto de qualquer outro que existisse.
      usuariosService.revogarTodosRefreshTokensAtivos.mockResolvedValueOnce(2);

      await expect(
        service.refresh({ refresh_token: 'token-A-ja-usado' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(usuariosService.revogarTodosRefreshTokensAtivos).toHaveBeenCalledWith(1);
    });

    // Cenário 4 — usuário correto: o usuarioId usado na cascata é sempre o
    // do REGISTRO do token apresentado (nunca outro usuário arbitrário).
    it('D: a cascata usa o usuarioId do registro do token reutilizado — nunca revoga tokens de outro usuário', async () => {
      usuariosService.buscarRefreshTokenPorHash.mockResolvedValueOnce({
        id: 20,
        usuarioId: 42,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: new Date(Date.now() - 5000),
      });

      await expect(
        service.refresh({ refresh_token: 'token-de-outro-usuario' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(usuariosService.revogarTodosRefreshTokensAtivos).toHaveBeenCalledWith(42);
      expect(usuariosService.revogarTodosRefreshTokensAtivos).not.toHaveBeenCalledWith(1);
    });

    it('token que nunca existiu (registro null): rejeitado sem acionar a cascata (não há usuarioId, e não é evidência de reuso)', async () => {
      usuariosService.buscarRefreshTokenPorHash.mockResolvedValueOnce(null);

      await expect(
        service.refresh({ refresh_token: 'token-inexistente' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(usuariosService.revogarTodosRefreshTokensAtivos).not.toHaveBeenCalled();
    });

    it('token expirado mas NUNCA revogado: rejeitado sem acionar a cascata (expiração natural não é evidência de reuso)', async () => {
      usuariosService.buscarRefreshTokenPorHash.mockResolvedValueOnce({
        id: 10,
        usuarioId: 1,
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      });

      await expect(
        service.refresh({ refresh_token: 'token-so-expirado' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(usuariosService.revogarTodosRefreshTokensAtivos).not.toHaveBeenCalled();
    });

    it('corrida de rotação já existente (Task 27): duas requisições com o mesmo token A ainda ativo — a segunda encontra count 0 em revogarRefreshTokenSeAtivo e é rejeitada, sem acionar a cascata (não é reuso de um token já revogado, é uma corrida no MESMO instante)', async () => {
      usuariosService.buscarRefreshTokenPorHash.mockResolvedValueOnce({
        id: 10,
        usuarioId: 1,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: null,
      });
      usuariosService.buscarAtivoPorId.mockResolvedValueOnce(USUARIO_ATIVO);
      usuariosService.revogarRefreshTokenSeAtivo.mockResolvedValueOnce(0);

      await expect(
        service.refresh({ refresh_token: 'token-A' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(usuariosService.criarRefreshToken).not.toHaveBeenCalled();
      expect(usuariosService.revogarTodosRefreshTokensAtivos).not.toHaveBeenCalled();
    });
  });
});
