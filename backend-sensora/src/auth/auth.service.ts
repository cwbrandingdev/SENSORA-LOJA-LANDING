import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { normalizarEmail } from '../common/utils/email.util';
import { escaparHtml } from '../common/utils/html.util';
import { MailService } from '../mail/mail.service';
import { AtualizarMeusDadosDto } from '../usuarios/dto/atualizar-meus-dados.dto';
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
// Cooldown da troca de e-mail em Minha Conta, por usuário — independente
// do cooldown de reenvio acima (ver AuthService.atualizarMeusDados).
const EMAIL_TROCA_COOLDOWN_MS = 60 * 1000;
const VERIFICATION_RESEND_MENSAGEM =
  'Se existir uma conta com esse e-mail ainda não confirmada, você receberá um novo link de confirmação.';
const EMAIL_JA_CONFIRMADO_MENSAGEM = 'Este e-mail já foi confirmado.';
const TOKEN_VERIFICACAO_INVALIDO_MENSAGEM = 'Token inválido ou expirado';
// Confirmação obrigatória no login — contrato explícito com o frontend
// (ver AllExceptionsFilter/lib/errors.ts, mesmo padrão de
// CODIGO_ERRO_FRETE_MELHOR_ENVIO em MelhorEnvioService): identifica esta
// causa específica de falha de login para que a tela possa redirecionar a
// /confirmar-email com opção de reenvio, em vez de só mostrar "credenciais
// inválidas". Mantenha o valor sincronizado com
// frontend-sensora/lib/errors.ts caso precise alterá-lo.
const CODIGO_EMAIL_NAO_VERIFICADO = 'EMAIL_NAO_VERIFICADO';
const EMAIL_NAO_VERIFICADO_MENSAGEM =
  'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada ou solicite um novo link de confirmação.';

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

    // Confirmação obrigatória — checada só depois da senha já validada
    // acima, de propósito: quem chega até aqui já provou conhecer a senha
    // correta, então devolver um motivo específico (em vez da mesma
    // "Credenciais inválidas") não abre nenhuma enumeração nova — um
    // atacante sem a senha correta nunca chega a ver esta distinção.
    if (!usuario.emailVerificado) {
      throw new ForbiddenException({
        message: EMAIL_NAO_VERIFICADO_MENSAGEM,
        code: CODIGO_EMAIL_NAO_VERIFICADO,
      });
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
        cpf: registerDto.cpf,
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

    // Etapa 8.3 (achado HIGH da auditoria — resetToken em texto puro) —
    // persiste só o HASH (mesmo mecanismo já usado para o token de
    // confirmação de e-mail, ver hashToken() abaixo). `resetToken` em
    // texto puro nunca é persistido — só existe nesta função, para ser
    // enviado por e-mail logo abaixo (enviarEmailResetSenha) e, no máximo,
    // devolvido na resposta se EXPOSE_RESET_TOKEN estiver habilitado.
    await this.usuariosService.salvarTokenReset(
      usuario.id,
      this.hashToken(resetToken),
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
    // Etapa 8.3 (achado HIGH da auditoria — resetToken em texto puro) —
    // nunca compara o token recebido diretamente com o banco: calcula o
    // hash do token recebido e localiza o usuário por esse hash (mesmo
    // padrão de verifyEmail/hashToken()).
    const usuario = await this.usuariosService.buscarPorResetToken(
      this.hashToken(resetPasswordDto.token),
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

    // MÉDIO-3: token que não é de confirmação de cadastro pode ser de troca
    // de e-mail pendente. O caminho de cadastro vem sempre primeiro (contas
    // antigas, inclusive as que trocaram de e-mail antes do MÉDIO-3, ainda
    // confirmam por emailVerificationHash).
    if (!usuario) {
      return this.confirmarTrocaDeEmail(tokenHash);
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

  // MÉDIO-3 — confirmação da troca de e-mail: o pendente vira o `email`
  // oficial (ver UsuariosService.confirmarEmailPendenteSeHashValido: uso
  // único, e 409 se outra conta já usa o endereço). Mesmas mensagens do
  // fluxo de cadastro; não gera sessão.
  private async confirmarTrocaDeEmail(
    tokenHash: string,
  ): Promise<VerifyEmailResponse> {
    const pendente =
      await this.usuariosService.buscarPorHashEmailPendente(tokenHash);

    if (
      !pendente ||
      !pendente.emailPendente ||
      !pendente.emailPendenteExpiraEm ||
      pendente.emailPendenteExpiraEm <= new Date()
    ) {
      throw new UnauthorizedException(TOKEN_VERIFICACAO_INVALIDO_MENSAGEM);
    }

    const confirmado =
      await this.usuariosService.confirmarEmailPendenteSeHashValido(
        pendente.id,
        tokenHash,
        pendente.emailPendente,
      );
    if (confirmado === 0) {
      // Outra chamada com o mesmo link já efetivou a troca entre a leitura
      // e a escrita (duplo clique).
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

  // Minha Conta (PUT /usuarios/me) — orquestra a troca de e-mail com o mesmo
  // fluxo de confirmação do cadastro. Sem troca de e-mail, é só um repasse
  // para UsuariosService.atualizarMeusDados. Com troca (MÉDIO-3), o endereço
  // novo fica PENDENTE: `email` continua o atual (login, reset de senha e
  // demais e-mails seguem nele) e só muda quando o link enviado ao novo
  // endereço for confirmado (verifyEmail). MailService nunca lança: se o
  // envio falhar, a troca fica pendente até expirar ou ser refeita.
  async atualizarMeusDados(
    usuarioId: number,
    dto: AtualizarMeusDadosDto,
  ): Promise<UsuarioPublico> {
    const atual = await this.usuariosService.findOne(usuarioId);

    if (normalizarEmail(dto.email) === atual.email) {
      return this.usuariosService.atualizarMeusDados(usuarioId, dto);
    }

    // Troca de e-mail exige a senha atual (ALTO-2): uma sessão roubada não
    // basta para tomar a conta. Ausente ou errada recebem a mesma resposta,
    // e nunca 401 — o frontend trata 401 fora de /auth/* como sessão
    // expirada. Nada é gravado, gerado ou enviado antes desta checagem.
    const conta = await this.usuariosService.buscarPorEmail(atual.email);
    const senhaValida =
      !!conta &&
      !!dto.senhaAtual &&
      (await bcrypt.compare(dto.senhaAtual, conta.senha));
    if (!conta || !senhaValida) {
      throw new BadRequestException('Senha atual incorreta.');
    }

    // Cooldown próprio da troca de e-mail (separado do de reenvio): toda
    // troca grava o token pendente com validade de
    // EMAIL_VERIFICATION_VALIDADE_MS, então `emailPendenteExpiraEm - validade`
    // é o instante em que a troca atual foi pedida. Usa só os campos da
    // troca — cadastro e reenvio (emailVerificationExpiry) não bloqueiam.
    // Null (nenhuma troca pendente) libera.
    if (conta.emailPendenteExpiraEm) {
      const emitidoEm =
        conta.emailPendenteExpiraEm.getTime() - EMAIL_VERIFICATION_VALIDADE_MS;
      if (Date.now() - emitidoEm < EMAIL_TROCA_COOLDOWN_MS) {
        throw new HttpException(
          'Aguarde um minuto antes de alterar o e-mail novamente.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const novoEmail = normalizarEmail(dto.email);
    const tokenTroca = randomBytes(32).toString('hex');
    const usuario = await this.usuariosService.atualizarMeusDados(
      usuarioId,
      dto,
      {
        emailPendenteTokenHash: this.hashToken(tokenTroca),
        emailPendenteExpiraEm: new Date(
          Date.now() + EMAIL_VERIFICATION_VALIDADE_MS,
        ),
      },
    );

    // Só depois de a troca pendente estar gravada: encerra as outras
    // sessões, manda o link só para o endereço novo e avisa o atual.
    await this.usuariosService.revogarTodosRefreshTokensAtivos(usuarioId);

    await this.enviarEmailVerificacao(
      { nome: usuario.nome, email: novoEmail },
      tokenTroca,
      'troca-email',
    );

    await this.avisarEmailAntigo(atual.email, atual.nome, novoEmail);

    return usuario;
  }

  // Aviso de segurança ao e-mail atual quando uma troca é pedida. Sem token
  // nem link; o novo endereço vai mascarado. Nunca lança: falha no envio não
  // desfaz o pedido.
  private async avisarEmailAntigo(
    emailAntigo: string,
    nome: string,
    emailNovo: string,
  ): Promise<void> {
    try {
      await this.mailService.enviarEmail({
        to: emailAntigo,
        subject: 'Alteração de e-mail solicitada — Sensora',
        html:
          `<p>Olá, ${escaparHtml(nome)}.</p>` +
          `<p>Foi solicitada a alteração do e-mail da sua conta na Sensora para ${escaparHtml(mascararEmail(emailNovo))}.</p>` +
          '<p>O novo endereço fica pendente até ser confirmado pelo link enviado a ele. Até lá, este continua sendo o e-mail da sua conta.</p>' +
          '<p>Se foi você, não é preciso fazer nada.</p>' +
          '<p>Se você não fez essa solicitação, redefina sua senha pela opção "Esqueci minha senha" (isso também cancela a alteração pendente) e entre em contato com o suporte da Sensora respondendo este e-mail.</p>',
      });
    } catch (erro) {
      this.logger.error(
        'Falha ao avisar o e-mail antigo sobre a troca de e-mail da conta.',
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
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
  // `motivo` só muda o texto: o link/token/validade são os mesmos nos dois
  // casos. Cadastro e reenvio usam 'cadastro' (padrão); troca de e-mail em
  // Minha Conta usa 'troca-email' — não faz sentido agradecer por "criar a
  // conta" a quem só trocou o endereço.
  private async enviarEmailVerificacao(
    usuario: { nome: string; email: string },
    token: string,
    motivo: 'cadastro' | 'troca-email' = 'cadastro',
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      this.logger.warn(
        'FRONTEND_URL não configurado — e-mail de confirmação não enviado.',
      );
      return;
    }

    const link = `${frontendUrl}/confirmar-email?token=${token}`;
    const trocaDeEmail = motivo === 'troca-email';

    await this.mailService.enviarEmail({
      to: usuario.email,
      subject: trocaDeEmail
        ? 'Confirme seu novo endereço de e-mail'
        : 'Confirme seu e-mail',
      html:
        `<p>Olá, ${escaparHtml(usuario.nome)}.</p>` +
        (trocaDeEmail
          ? '<p>Foi solicitada a troca do e-mail da sua conta na Sensora para este endereço. Clique no link abaixo para confirmar o novo endereço:</p>'
          : '<p>Obrigado por criar sua conta na Sensora! Clique no link abaixo para confirmar seu e-mail:</p>') +
        `<p><a href="${link}">${link}</a></p>` +
        `<p>Este link expira em ${EMAIL_VERIFICATION_VALIDADE_HORAS} horas.</p>` +
        (trocaDeEmail
          ? '<p>Se você não fez essa alteração, ignore este e-mail e fale com a gente.</p>'
          : '<p>Se você não criou uma conta na Sensora, ignore este e-mail.</p>'),
    });
  }

  // Task 27. Rotação obrigatória: um refresh token só pode ser trocado por
  // um novo par de tokens uma única vez — ver revogarRefreshTokenSeAtivo()
  // em usuarios.service.ts para a garantia de atomicidade contra duas
  // requisições simultâneas com o mesmo token.
  //
  // Etapa 10 / AUTH-04 (achado da auditoria — reuso de refresh token sem
  // revogação em cascata): um token com `revokedAt !== null` já foi usado
  // uma vez antes — reapresentá-lo é o sinal clássico de token roubado (o
  // dono legítimo já rotacionou para um token seguinte; se outra parte
  // ainda tem o valor antigo, é porque o obteve por algum meio ilegítimo).
  // Antes desta correção, essa reapresentação era só rejeitada — o(s)
  // token(s) seguinte(s) da cadeia (emitidos pela rotação legítima)
  // continuavam válidos indefinidamente, mesmo com evidência de
  // comprometimento. Agora, ao detectar o reuso, revogamos TODAS as
  // sessões ativas do usuário (revogarTodosRefreshTokensAtivos, já
  // existente e usado em resetPassword()/alterarMinhaSenha — reaproveitado
  // aqui, não há uma segunda implementação de revogação) antes de rejeitar
  // — contenção real, não só detecção. Checado antes de expiresAt/!registro
  // de propósito: um token revogado É o sinal de reuso mesmo que também já
  // tenha expirado nesse meio-tempo; um token que nunca existiu ou só
  // expirou sem nunca ter sido revogado não é evidência de reuso, então não
  // aciona a cascata.
  async refresh(refreshTokenDto: RefreshTokenDto): Promise<AuthToken> {
    const tokenHash = this.hashToken(refreshTokenDto.refresh_token);
    const registro =
      await this.usuariosService.buscarRefreshTokenPorHash(tokenHash);

    if (registro && registro.revokedAt !== null) {
      await this.usuariosService.revogarTodosRefreshTokensAtivos(
        registro.usuarioId,
      );
      throw new UnauthorizedException(REFRESH_TOKEN_INVALIDO_MENSAGEM);
    }

    if (!registro || registro.expiresAt <= new Date()) {
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
      subject: 'Redefinição de senha — Sensora',
      html:
        `<p>Olá, ${escaparHtml(usuario.nome)}.</p>` +
        // Etapa 8.0 (achado da auditoria): o template original nunca
        // mencionava "Sensora" no corpo/assunto (diferente do e-mail de
        // confirmação) — corrigido para identificar claramente o
        // remetente, sem redesign visual.
        '<p>Recebemos uma solicitação para redefinir a senha da sua conta na Sensora. Clique no link abaixo para continuar:</p>' +
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

// "joao.silva@gmail.com" -> "jo***@gmail.com" (aviso ao e-mail antigo).
function mascararEmail(email: string): string {
  const [local, dominio] = email.split('@');
  return `${local.slice(0, Math.min(2, local.length - 1))}***@${dominio}`;
}
