import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Usuario as UsuarioPrisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarMeusDadosDto } from './dto/atualizar-meus-dados.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Usuario, UsuarioPublico } from './entities/usuario.entity';
import { PerfilUsuario } from './enums/perfil-usuario.enum';

const SALT_ROUNDS = 10;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<UsuarioPublico[]> {
    const usuarios = await this.prisma.usuario.findMany();
    return usuarios.map((usuario) => this.paraPublico(usuario));
  }

  async findOne(id: number): Promise<UsuarioPublico> {
    return this.paraPublico(await this.localizar(id));
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      return null;
    }
    return { ...usuario, perfil: usuario.perfil as PerfilUsuario };
  }

  // Usado pela JwtStrategy a cada requisição autenticada para confirmar que
  // o usuário ainda existe e segue ativo — nunca confia só no payload do
  // token. Só seleciona os campos necessários (sem `senha`).
  async buscarAtivoPorId(id: number): Promise<{
    id: number;
    email: string;
    perfil: PerfilUsuario;
    ativo: boolean;
  } | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, email: true, perfil: true, ativo: true },
    });
    if (!usuario) {
      return null;
    }
    return { ...usuario, perfil: usuario.perfil as PerfilUsuario };
  }

  async create(createUsuarioDto: CreateUsuarioDto): Promise<UsuarioPublico> {
    const senhaCriptografada = await bcrypt.hash(
      createUsuarioDto.senha,
      SALT_ROUNDS,
    );
    const usuario = await this.prisma.usuario.create({
      data: {
        ...createUsuarioDto,
        senha: senhaCriptografada,
        ativo: createUsuarioDto.ativo ?? true,
      },
    });
    return this.paraPublico(usuario);
  }

  async update(
    id: number,
    updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<UsuarioPublico> {
    await this.localizar(id);
    const { senha, ...rest } = updateUsuarioDto;

    const usuario = await this.prisma.usuario.update({
      where: { id },
      data: {
        ...rest,
        ...(senha !== undefined && {
          senha: await bcrypt.hash(senha, SALT_ROUNDS),
        }),
      },
    });

    // Achado da auditoria (revogação de sessão após troca de senha): uma
    // troca administrativa de senha só é uma medida de segurança de verdade
    // se também encerrar sessões já emitidas com a senha antiga — sem isso,
    // um refresh token já roubado continuaria valendo normalmente.
    if (senha !== undefined) {
      await this.revogarTodosRefreshTokensAtivos(id);
    }

    return this.paraPublico(usuario);
  }

  // Etapa 3 (Minha Conta / Dados Pessoais) — autoatendimento: reaproveita
  // update() sem duplicar a lógica (localizar/mapear para público), só
  // acrescenta a checagem de duplicidade de e-mail que update() nunca teve
  // (PUT /usuarios/:id administrativo tinha essa mesma lacuna — sem este
  // pre-check, uma colisão de e-mail estourava um erro do Prisma não
  // tratado, virando 500 genérico em vez de um 409 claro). Mesmo padrão já
  // usado em AuthService.register(). `existente.id !== id`: o próprio
  // usuário mantendo o e-mail que já tinha não é duplicidade.
  async atualizarMeusDados(
    id: number,
    dto: AtualizarMeusDadosDto,
  ): Promise<UsuarioPublico> {
    const existente = await this.buscarPorEmail(dto.email);
    if (existente && existente.id !== id) {
      throw new ConflictException('Este e-mail já está em uso por outra conta.');
    }
    return this.update(id, dto);
  }

  // Etapa 3 (Minha Conta / Segurança) — troca de senha autoatendida. Exige a
  // senha ATUAL (diferente do reset via token de e-mail) para provar que
  // quem está pedindo a troca é realmente o dono da sessão. Reaproveita
  // update() para o hash + revogação de refresh tokens (Task 27) — nenhuma
  // lógica de senha duplicada aqui.
  async alterarMinhaSenha(
    id: number,
    senhaAtual: string,
    novaSenha: string,
  ): Promise<void> {
    const usuario = await this.localizar(id);
    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }
    await this.update(id, { senha: novaSenha });
  }

  // Achado da auditoria (lockout operacional): sem estas duas travas, um
  // ADMIN podia excluir a própria conta ou o único outro ADMIN restante,
  // deixando o sistema sem ninguém capaz de gerenciar usuários.
  async remove(id: number, requestingUserId: number): Promise<void> {
    const usuario = await this.localizar(id);

    if (usuario.id === requestingUserId) {
      throw new ConflictException('Não é possível excluir a própria conta.');
    }

    // Só importa se o alvo for um ADMIN atualmente ativo — excluir um ADMIN
    // já desativado não reduz a contagem de ADMINs ativos, então não há
    // risco de lockout nesse caso.
    if (
      (usuario.perfil as PerfilUsuario) === PerfilUsuario.ADMIN &&
      usuario.ativo
    ) {
      const adminsAtivos = await this.prisma.usuario.count({
        where: { perfil: PerfilUsuario.ADMIN, ativo: true },
      });
      if (adminsAtivos <= 1) {
        throw new ConflictException(
          'Não é possível excluir o único administrador ativo do sistema.',
        );
      }
    }

    await this.prisma.usuario.delete({ where: { id } });
  }

  async salvarTokenReset(
    id: number,
    resetToken: string,
    resetTokenExpiry: Date,
  ): Promise<void> {
    await this.prisma.usuario.update({
      where: { id },
      data: { resetToken, resetTokenExpiry },
    });
  }

  async buscarPorResetToken(
    resetToken: string,
  ): Promise<{ id: number; resetTokenExpiry: Date | null } | null> {
    return this.prisma.usuario.findFirst({
      where: { resetToken },
      select: { id: true, resetTokenExpiry: true },
    });
  }

  async redefinirSenha(id: number, novaSenha: string): Promise<void> {
    const senhaCriptografada = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    await this.prisma.usuario.update({
      where: { id },
      data: {
        senha: senhaCriptografada,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }

  // Task 27 — só o hash (SHA-256, calculado em AuthService) é gravado;
  // o refresh token em texto puro nunca chega ao banco.
  async criarRefreshToken(
    usuarioId: number,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { usuarioId, tokenHash, expiresAt },
    });
  }

  async buscarRefreshTokenPorHash(tokenHash: string): Promise<{
    id: number;
    usuarioId: number;
    expiresAt: Date;
    revokedAt: Date | null;
  } | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, usuarioId: true, expiresAt: true, revokedAt: true },
    });
  }

  // updateMany com `revokedAt: null` na cláusula where torna a revogação
  // atômica no nível do banco: se duas requisições tentarem usar/revogar o
  // mesmo token ao mesmo tempo, só uma delas encontra a linha ainda ativa
  // (count === 1) — a outra recebe count === 0, sem precisar de uma
  // transaction explícita (Task 27, requisito de rotação segura).
  async revogarRefreshTokenSeAtivo(tokenHash: string): Promise<number> {
    const resultado = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return resultado.count;
  }

  // Achado da auditoria: chamado sempre que a senha de um usuário é alterada
  // (reset via /auth/reset-password ou update administrativo via
  // PUT /usuarios/:id), para que refresh tokens emitidos com a senha antiga
  // parem de funcionar. Mesmo padrão de updateMany condicional de
  // revogarRefreshTokenSeAtivo — não afeta tokens de outros usuários nem
  // tokens já revogados (where usuarioId + revokedAt: null).
  async revogarTodosRefreshTokensAtivos(usuarioId: number): Promise<number> {
    const resultado = await this.prisma.refreshToken.updateMany({
      where: { usuarioId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return resultado.count;
  }

  private async localizar(id: number): Promise<UsuarioPrisma> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException(`Usuário com id ${id} não encontrado`);
    }
    return usuario;
  }

  private paraPublico(usuario: UsuarioPrisma): UsuarioPublico {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil as PerfilUsuario,
      ativo: usuario.ativo,
    };
  }
}
