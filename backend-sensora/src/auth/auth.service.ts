import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import { Usuario, UsuarioPublico } from '../usuarios/entities/usuario.entity';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AlterarMinhaSenhaDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthToken } from './entities/auth-token.entity';
import { ChangePasswordResponse } from './entities/change-password-response.entity';
import { ForgotPasswordResponse } from './entities/forgot-password-response.entity';
import { LogoutResponse } from './entities/logout-response.entity';
import { ResendVerificationResponse } from './entities/resend-verification-response.entity';
import { ResetPasswordResponse } from './entities/reset-password-response.entity';
import { VerifyEmailResponse } from './entities/verify-email-response.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

const RESET_TOKEN_MENSAGEM =
  'Se existir uma conta com esse e-mail, você receberá instruções para redefinir sua senha.';
const RESET_TOKEN_VALIDADE_MS = 60 * 60 * 1000;
const RESET_TOKEN_VALIDADE_HORAS = RESET_TOKEN_VALIDADE_MS / (60 * 60 * 1000);
const REFRESH_TOKEN_INVALIDO_MENSAGEM = 'Refresh token inválido ou expirado';

// Etapa 6.4 (Confirmação de e-mail) — decisões já aprovadas: 48h de validade
// (mais generoso que o reset de senha, de propósito: confirmar e-mail não é
// tão sensível a tempo quanto trocar senha, e é comum o usuário só abrir o
// e-mail bem depois do cadastro).
const EMAIL_VERIFICATION_VALIDADE_MS = 48 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_VALIDADE_HORAS =
  EMAIL_VERIFICATION_VALIDADE_MS / (60 * 60 * 1000);
// Limite de reenvio por e-mail-alvo (além do ThrottlerGuard por IP, que já
// cobre a rota inteira) — evita que alguém spamme a caixa de entrada de
// outra pessoa reenviando repetidamente para o mesmo e-mail, mesmo de IPs
// diferentes ou depois da janela do throttler por IP resetar. Calculado sem
// precisar de uma coluna nova: `emailVerificationExpiry - validade` é
// exatamente o instante em que o token atual foi emitido (ver
// podeReenviarVerificacao).
const EMAIL_VERIFICATION_REENVIO_COOLDOWN_MS = 60 * 1000;
const VERIFICATION_RESEND_MENSAGEM =
  'Se existir uma conta com esse e-mail ainda não confirmada, você receberá um novo link de confirmação.';
const EMAIL_JA_CONFIRMADO_MENSAGEM = 'Este e-mail já foi confirmado.';
const TOKEN_VERIFICACAO_INVALIDO_MENSAGEM = 'Token inválido ou expirado';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthToken> {
    const usuario = await this.usuariosService.buscarPorEmail(loginDto.email);
    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const senhaValida = await bcrypt.compare(loginDto.senha, usuario.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.gerarParDeTokens(usuario.id, usuario.email, usuario.perfil);
  }

  // Etapa 6.4 (Confirmação de e-mail) — cadastro público (CLIENTE) sempre
  // nasce com emailVerificado:false e recebe o e-mail de confirmação nesta
  // mesma chamada, automaticamente. Contas administrativas (ADMIN/VENDEDOR,
  // criadas via UsuariosController.create) NÃO passam por aqui — continuam
  // chamando usuariosService.create() sem a opção emailVerificado, e nascem
  // já verificadas (ver comentário no schema.prisma). Login e checkout
  // preservados: registro continua sem autenticar automaticamente (nenhuma
  // chamada a gerarParDeTokens aqui).
  async register(registerDto: RegisterDto): Promise<UsuarioPublico> {
    const usuarioExistente = await this.usuariosService.buscarPorEmail(
      registerDto.email,
    );
    if (usuarioExistente) {
      throw new ConflictException(
        'Já existe um usuário cadastrado com este e-mail',
      );
    }

    const usuario = await this.usuariosService.create(
      {
        nome: registerDto.nome,
        email: registerDto.email,
        senha: registerDto.senha,
        perfil: PerfilUsuario.CLIENTE,
        ativo: true,
      },
      { emailVerificado: false },
    );

    const emailVerificationToken = randomBytes(32).toString('hex');
    const emailVerificationExpiry = new Date(
      Date.now() + EMAIL_VERIFICATION_VALIDADE_MS,
    );

    await this.usuariosService.emitirTokenVerificacaoEmail(
      usuario.id,
      this.hashToken(emailVerificationToken),
      emailVerificationExpiry,
    );

    await this.enviarEmailVerificacao(usuario, emailVerificationToken);

    return usuario;
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    const usuario = await this.usuariosService.buscarPorEmail(
      forgotPasswordDto.email,
    );

    if (!usuario) {
      return { message: RESET_TOKEN_MENSAGEM };
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_VALIDADE_MS);

    await this.usuariosService.salvarTokenReset(
      usuario.id,
      resetToken,
      resetTokenExpiry,
    );

    // MailService.enviarEmail() nunca lança (falha vira log, não exceção) —
    // o token já está persistido acima, então mesmo se o e-mail falhar
    // (provedor indisponível, credencial ausente, timeout), a resposta ao
    // cliente permanece a mesma de sempre (RESET_TOKEN_MENSAGEM genérica),
    // sem revelar se o envio deu certo (Task 26).
    await this.enviarEmailResetSenha(usuario, resetToken);

    // Fail-safe / opt-in: o token só volta na resposta se EXPOSE_RESET_TOKEN
    // estiver explicitamente "true". Ausência da variável (ou qualquer outro
    // valor) mantém o comportamento seguro por padrão — nunca usar NODE_ENV
    // aqui, pois um deploy sem essa variável setada cairia no lado inseguro.
    const deveExporToken =
      this.configService.get<string>('EXPOSE_RESET_TOKEN') === 'true';

    return deveExporToken
      ? { message: RESET_TOKEN_MENSAGEM, token: resetToken }
      : { message: RESET_TOKEN_MENSAGEM };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponse> {
    const usuario = await this.usuariosService.buscarPorResetToken(
      resetPasswordDto.token,
    );

    if (!usuario) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    if (!usuario.resetTokenExpiry || usuario.resetTokenExpiry <= new Date()) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    await this.usuariosService.redefinirSenha(
      usuario.id,
      resetPasswordDto.novaSenha,
    );

    // Achado da auditoria: sem isso, um refresh token roubado antes do reset
    // continuaria válido depois — a troca de senha precisa encerrar todas as
    // sessões existentes, não só bloquear login com a senha antiga.
    await this.usuariosService.revogarTodosRefreshTokensAtivos(usuario.id);

    return { message: 'Senha redefinida com sucesso.' };
  }

  // Etapa 6.4 (Confirmação de e-mail) — decisão aprovada: o token NUNCA
  // autentica (nenhuma chamada a gerarParDeTokens aqui, diferente de
  // login/refresh). Confirmar o e-mail só marca a conta como verificada;
  // o usuário continua precisando fazer login normalmente depois.
  //
  // Duas mensagens de sucesso possíveis (token válido confirmado agora, ou
  // "já confirmado") e uma de erro genérica (token inválido/expirado) — a
  // mensagem de erro nunca distingue "nunca existiu" de "já foi usado uma
  // vez, em uma sessão anterior": depois do primeiro uso o hash é limpo
  // (uso único, ver confirmarEmailSeHashValido), então uma segunda tentativa
  // com o mesmo link, mais tarde, deixa de encontrar o usuário por hash —
  // indistinguível de um token que nunca existiu, por design (mesmo
  // raciocínio de resetPassword). A mensagem amigável de "já confirmado" só
  // é possível nos dois casos em que isso pode ser determinado com
  // segurança: o usuário já está marcado como verificado no momento da
  // leitura, ou uma confirmação concorrente (duplo clique/reenvio da mesma
  // requisição) já consumiu este mesmo hash entre a leitura e a escrita.
  async verifyEmail(dto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    const tokenHash = this.hashToken(dto.token);
    const usuario =
      await this.usuariosService.buscarPorHashVerificacaoEmail(tokenHash);

    if (!usuario) {
      throw new UnauthorizedException(TOKEN_VERIFICACAO_INVALIDO_MENSAGEM);
    }

    if (usuario.emailVerificado) {
      return { message: EMAIL_JA_CONFIRMADO_MENSAGEM };
    }

    if (
      !usuario.emailVerificationExpiry ||
      usuario.emailVerificationExpiry <= new Date()
    ) {
      throw new UnauthorizedException(TOKEN_VERIFICACAO_INVALIDO_MENSAGEM);
    }

    const confirmado = await this.usuariosService.confirmarEmailSeHashValido(
      usuario.id,
      tokenHash,
    );
    if (confirmado === 0) {
      // Corrida rara (duplo clique, ou a mesma requisição reenviada pelo
      // navegador): outra chamada já confirmou com este mesmo hash entre a
      // leitura acima e esta escrita.
      return { message: EMAIL_JA_CONFIRMADO_MENSAGEM };
    }

    return { message: 'E-mail confirmado com sucesso.' };
  }

  // Etapa 6.4 (Confirmação de e-mail) — mesmo padrão anti-enumeração de
  // forgotPassword: SEMPRE a mesma mensagem genérica, independente de o
  // e-mail existir, já estar confirmado, ou estar dentro do cooldown de
  // reenvio — nenhum desses casos é revelado ao chamador. Só gera e envia um
  // token novo quando as três condições abaixo são verdadeiras; em qualquer
  // outro caso, é um no-op silencioso.
  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<ResendVerificationResponse> {
    const usuario = await this.usuariosService.buscarPorEmail(dto.email);

    if (
      usuario &&
      !usuario.emailVerificado &&
      this.podeReenviarVerificacao(usuario.emailVerificationExpiry)
    ) {
      const emailVerificationToken = randomBytes(32).toString('hex');
      const emailVerificationExpiry = new Date(
        Date.now() + EMAIL_VERIFICATION_VALIDADE_MS,
      );

      // Sobrescreve o hash/expiração anteriores — o token antigo (se
      // existia) para de bater em qualquer busca a partir daqui, invalidado
      // pelo próprio reenvio, sem precisar de um passo separado para limpá-lo.
      await this.usuariosService.emitirTokenVerificacaoEmail(
        usuario.id,
        this.hashToken(emailVerificationToken),
        emailVerificationExpiry,
      );

      await this.enviarEmailVerificacao(usuario, emailVerificationToken);
    }

    return { message: VERIFICATION_RESEND_MENSAGEM };
  }

  // Limite de reenvio por e-mail-alvo (aprovado, requisito 12): sem coluna
  // nova — `emailVerificationExpiry - EMAIL_VERIFICATION_VALIDADE_MS` é
  // exatamente o instante em que o token atual foi emitido (seja pelo
  // cadastro, seja por um reenvio anterior), então basta comparar essa data
  // contra o cooldown. `null` (nunca houve token, ou já foi confirmado e
  // limpo) sempre libera o reenvio.
  private podeReenviarVerificacao(expiryAtual: Date | null): boolean {
    if (!expiryAtual) {
      return true;
    }
    const emitidoEm = expiryAtual.getTime() - EMAIL_VERIFICATION_VALIDADE_MS;
    return Date.now() - emitidoEm >= EMAIL_VERIFICATION_REENVIO_COOLDOWN_MS;
  }

  // Mesmo raciocínio de enviarEmailResetSenha: FRONTEND_URL ausente só pula
  // o envio (com warning), nunca derruba o fluxo que chamou este método.
  private async enviarEmailVerificacao(
    usuario: { nome: string; email: string },
    token: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — e-mail de confirmação não enviado.',
      );
      return;
    }

    const link = `${frontendUrl}/confirmar-email?token=${token}`;

    await this.mailService.enviarEmail({
      to: usuario.email,
      subject: 'Confirme seu e-mail',
      html:
        `<p>Olá, ${usuario.nome}.</p>` +
        '<p>Obrigado por criar sua conta na Sensora! Clique no link abaixo para confirmar seu e-mail:</p>' +
        `<p><a href="${link}">${link}</a></p>` +
        `<p>Este link expira em ${EMAIL_VERIFICATION_VALIDADE_HORAS} horas.</p>` +
        '<p>Se você não criou uma conta na Sensora, ignore este e-mail.</p>',
    });
  }

  // Task 27. Rotação obrigatória: um refresh token só pode ser trocado por
  // um novo par de tokens uma única vez — ver revogarRefreshTokenSeAtivo()
  // em usuarios.service.ts para a garantia de atomicidade contra duas
  // requisições simultâneas com o mesmo token.
  async refresh(refreshTokenDto: RefreshTokenDto): Promise<AuthToken> {
    const tokenHash = this.hashToken(refreshTokenDto.refresh_token);
    const registro =
      await this.usuariosService.buscarRefreshTokenPorHash(tokenHash);

    if (
      !registro ||
      registro.revokedAt !== null ||
      registro.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException(REFRESH_TOKEN_INVALIDO_MENSAGEM);
    }

    const usuario = await this.usuariosService.buscarAtivoPorId(
      registro.usuarioId,
    );
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException(REFRESH_TOKEN_INVALIDO_MENSAGEM);
    }

    // Revogação condicional atômica: se outra requisição já rotacionou este
    // mesmo token entre a leitura acima e esta linha, count() vem 0 e a
    // reutilização é rejeitada — nenhum segundo par de tokens é emitido a
    // partir do mesmo refresh token.
    const revogado =
      await this.usuariosService.revogarRefreshTokenSeAtivo(tokenHash);
    if (revogado === 0) {
      throw new UnauthorizedException(REFRESH_TOKEN_INVALIDO_MENSAGEM);
    }

    return this.gerarParDeTokens(usuario.id, usuario.email, usuario.perfil);
  }

  // Idempotente por natureza: revogarRefreshTokenSeAtivo() simplesmente não
  // afeta nenhuma linha se o token já estiver revogado ou nunca tiver
  // existido — sem lançar erro nem revelar qual dos dois casos ocorreu
  // (mesmo padrão anti-enumeração de forgotPassword). O access token já
  // emitido continua válido até expirar naturalmente — não há blacklist de
  // access token nesta task.
  async logout(refreshTokenDto: RefreshTokenDto): Promise<LogoutResponse> {
    const tokenHash = this.hashToken(refreshTokenDto.refresh_token);
    await this.usuariosService.revogarRefreshTokenSeAtivo(tokenHash);
    return { message: 'Logout realizado com sucesso.' };
  }

  // Etapa 3 (Minha Conta / Segurança) — orquestra a troca de senha
  // autoatendida: valida a senha atual e reaproveita, através de
  // UsuariosService.alterarMinhaSenha(), o mesmo hash bcrypt + revogação de
  // refresh tokens já usados por update()/resetPassword() (Task 27) —
  // nenhuma lógica de senha duplicada aqui. O access token já emitido
  // continua válido até expirar naturalmente, mesmo comportamento já aceito
  // em resetPassword() (não há blacklist de access token neste projeto).
  async changePassword(
    usuarioId: number,
    dto: AlterarMinhaSenhaDto,
  ): Promise<ChangePasswordResponse> {
    await this.usuariosService.alterarMinhaSenha(
      usuarioId,
      dto.senhaAtual,
      dto.novaSenha,
    );
    return { message: 'Senha alterada com sucesso.' };
  }

  // FRONTEND_URL não está no ConfigModule.validationSchema (mesmo raciocínio
  // de RESEND_API_KEY/EMAIL_FROM em mail.service.ts): opcional, e sem ela
  // não há como montar um link válido — o e-mail simplesmente não é
  // enviado, sem afetar o restante do fluxo de forgot-password.
  private async enviarEmailResetSenha(
    usuario: Usuario,
    resetToken: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — e-mail de redefinição de senha não enviado.',
      );
      return;
    }

    const link = `${frontendUrl}/reset-password?token=${resetToken}`;

    await this.mailService.enviarEmail({
      to: usuario.email,
      subject: 'Redefinição de senha',
      html:
        `<p>Olá, ${usuario.nome}.</p>` +
        '<p>Recebemos uma solicitação para redefinir sua senha. Clique no link abaixo para continuar:</p>' +
        `<p><a href="${link}">${link}</a></p>` +
        `<p>Este link expira em ${RESET_TOKEN_VALIDADE_HORAS} hora(s).</p>` +
        '<p>Se você não solicitou isso, ignore este e-mail — sua senha continua a mesma.</p>',
    });
  }

  // Único ponto de emissão de tokens — login() e refresh() sem duplicar a
  // lógica de assinatura do access token nem a persistência do refresh
  // token (Task 27).
  private async gerarParDeTokens(
    usuarioId: number,
    email: string,
    perfil: PerfilUsuario,
  ): Promise<AuthToken> {
    const payload: JwtPayload = { sub: usuarioId, email, perfil };
    const accessToken = this.jwtService.sign(payload);

    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenExpiresInSegundos = Number(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN'),
    );
    const expiresAt = new Date(
      Date.now() + refreshTokenExpiresInSegundos * 1000,
    );

    await this.usuariosService.criarRefreshToken(
      usuarioId,
      this.hashToken(refreshToken),
      expiresAt,
    );

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  // SHA-256 (não bcrypt): o refresh token já é 32 bytes aleatórios de alta
  // entropia — diferente de senha, não precisa de hash lento para resistir
  // a força bruta, só de não ficar em texto puro no banco.
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
