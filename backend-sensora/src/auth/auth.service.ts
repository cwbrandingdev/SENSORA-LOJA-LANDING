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
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthToken } from './entities/auth-token.entity';
import { ChangePasswordResponse } from './entities/change-password-response.entity';
import { ForgotPasswordResponse } from './entities/forgot-password-response.entity';
import { LogoutResponse } from './entities/logout-response.entity';
import { ResetPasswordResponse } from './entities/reset-password-response.entity';
import { JwtPayload } from './interfaces/jwt-payload.interface';

const RESET_TOKEN_MENSAGEM =
  'Se existir uma conta com esse e-mail, você receberá instruções para redefinir sua senha.';
const RESET_TOKEN_VALIDADE_MS = 60 * 60 * 1000;
const RESET_TOKEN_VALIDADE_HORAS = RESET_TOKEN_VALIDADE_MS / (60 * 60 * 1000);
const REFRESH_TOKEN_INVALIDO_MENSAGEM = 'Refresh token inválido ou expirado';

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

  async register(registerDto: RegisterDto): Promise<UsuarioPublico> {
    const usuarioExistente = await this.usuariosService.buscarPorEmail(
      registerDto.email,
    );
    if (usuarioExistente) {
      throw new ConflictException(
        'Já existe um usuário cadastrado com este e-mail',
      );
    }

    return this.usuariosService.create({
      nome: registerDto.nome,
      email: registerDto.email,
      senha: registerDto.senha,
      perfil: PerfilUsuario.CLIENTE,
      ativo: true,
    });
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
