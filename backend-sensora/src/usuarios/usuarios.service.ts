import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  Prisma,
  type Usuario as UsuarioPrisma,
} from '../../generated/prisma/client';
import { cpfValido, normalizarCpf } from '../common/utils/cpf.util';
import { normalizarTelefone, telefoneValido } from '../common/utils/telefone.util';
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

  // Etapa 6.4 (Confirmação de e-mail) — `opcoes.emailVerificado` é um
  // parâmetro só de uso interno (nunca exposto em CreateUsuarioDto/rota
  // HTTP): omitido, o Prisma aplica o @default(true) do schema, que é
  // exatamente o que se quer tanto para contas administrativas
  // (UsuariosController.create, ADMIN/VENDEDOR/CLIENTE criados pelo painel)
  // quanto para qualquer outro chamador futuro deste método — nascer
  // "verificado" é o padrão seguro. Só AuthService.register() (cadastro
  // público) passa explicitamente `{ emailVerificado: false }`.
  async create(
    createUsuarioDto: CreateUsuarioDto,
    opcoes?: { emailVerificado?: boolean },
  ): Promise<UsuarioPublico> {
    const senhaCriptografada = await bcrypt.hash(
      createUsuarioDto.senha,
      SALT_ROUNDS,
    );
    const { cpf, telefone, ...rest } = createUsuarioDto;

    const data: Prisma.UsuarioCreateInput = {
      ...rest,
      senha: senhaCriptografada,
      ativo: createUsuarioDto.ativo ?? true,
      ...(opcoes?.emailVerificado !== undefined && {
        emailVerificado: opcoes.emailVerificado,
      }),
    };

    // Etapa "Dados do Cliente / Cadastro" (fechamento administrativo) —
    // criação ainda não tem id próprio, então a checagem de duplicidade em
    // normalizarEValidarCpfParaUsuario recebe `null`: qualquer CPF já
    // cadastrado por OUTRO usuário vira conflito (nunca há "o próprio
    // usuário mantendo o CPF que já tinha" numa criação).
    if (cpf !== undefined) {
      data.cpf = await this.normalizarEValidarCpfParaUsuario(null, cpf);
    }
    if (telefone !== undefined) {
      data.telefone = this.normalizarEValidarTelefone(telefone);
    }

    try {
      const usuario = await this.prisma.usuario.create({ data });
      return this.paraPublico(usuario);
    } catch (erro) {
      // Mesma proteção contra corrida de atualizarMeusDados: o findUnique
      // dentro de normalizarEValidarCpfParaUsuario não é atômico com este
      // create.
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Este CPF já está em uso por outra conta.');
      }
      throw erro;
    }
  }

  async update(
    id: number,
    updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<UsuarioPublico> {
    await this.localizar(id);
    const { senha, cpf, telefone, ...rest } = updateUsuarioDto;

    const data: Prisma.UsuarioUpdateInput = { ...rest };

    if (senha !== undefined) {
      data.senha = await bcrypt.hash(senha, SALT_ROUNDS);
    }
    if (cpf !== undefined) {
      data.cpf = await this.normalizarEValidarCpfParaUsuario(id, cpf);
    }
    if (telefone !== undefined) {
      data.telefone = this.normalizarEValidarTelefone(telefone);
    }

    try {
      const usuario = await this.prisma.usuario.update({ where: { id }, data });

      // Achado da auditoria (revogação de sessão após troca de senha): uma
      // troca administrativa de senha só é uma medida de segurança de
      // verdade se também encerrar sessões já emitidas com a senha antiga —
      // sem isso, um refresh token já roubado continuaria valendo
      // normalmente.
      if (senha !== undefined) {
        await this.revogarTodosRefreshTokensAtivos(id);
      }

      return this.paraPublico(usuario);
    } catch (erro) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Este CPF já está em uso por outra conta.');
      }
      throw erro;
    }
  }

  // Etapa 3 (Minha Conta / Dados Pessoais) + Etapa "Dados do Cliente /
  // Cadastro" (cpf/telefone) — autoatendimento. Não reaproveita update()
  // aqui porque AtualizarMeusDadosDto é uma whitelist deliberadamente mais
  // restrita (nunca perfil/ativo/senha — ver comentário no próprio DTO), não
  // porque update() careça de suporte a cpf/telefone: desde o fechamento
  // administrativo desta etapa, create()/update() também validam/normalizam/
  // checam duplicidade de CPF através dos mesmos helpers privados abaixo
  // (normalizarEValidarCpfParaUsuario/normalizarEValidarTelefone). Mesma
  // checagem de duplicidade de e-mail de sempre (`existente.id !== id`: o
  // próprio usuário mantendo o e-mail que já tinha não é duplicidade) — o
  // mesmo raciocínio é aplicado ao CPF logo abaixo, em
  // normalizarEValidarCpfParaUsuario.
  async atualizarMeusDados(
    id: number,
    dto: AtualizarMeusDadosDto,
  ): Promise<UsuarioPublico> {
    await this.localizar(id);

    const existente = await this.buscarPorEmail(dto.email);
    if (existente && existente.id !== id) {
      throw new ConflictException('Este e-mail já está em uso por outra conta.');
    }

    const data: Prisma.UsuarioUpdateInput = {
      nome: dto.nome,
      email: dto.email,
    };

    if (dto.cpf !== undefined) {
      data.cpf = await this.normalizarEValidarCpfParaUsuario(id, dto.cpf);
    }

    if (dto.telefone !== undefined) {
      data.telefone = this.normalizarEValidarTelefone(dto.telefone);
    }

    try {
      const usuario = await this.prisma.usuario.update({ where: { id }, data });
      return this.paraPublico(usuario);
    } catch (erro) {
      // Proteção adicional contra corrida (item 6 da etapa): a checagem de
      // duplicidade acima (findUnique) não é atômica com este update — duas
      // requisições simultâneas definindo o MESMO CPF novo podem ambas
      // passar por ela antes de qualquer uma escrever. O @unique do
      // Postgres é quem resolve de verdade (só uma das duas escritas
      // sucede); aqui só traduzimos o P2002 resultante numa mensagem de
      // negócio clara em vez de deixar vazar como 500 genérico.
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        throw new ConflictException('Este CPF já está em uso por outra conta.');
      }
      throw erro;
    }
  }

  // CPF vazio ("") limpa o campo (volta a null) — é como o formulário de
  // Minha Conta remove um CPF já cadastrado. Validação de verdade (dígitos
  // verificadores) via CpfUtil; duplicidade checada explicitamente aqui
  // (além do @unique do schema, que só entra em ação na escrita — ver P2002
  // acima) para devolver um 409 com mensagem clara em vez do erro cru do
  // Prisma no caminho feliz (sem corrida). `usuarioId: null` identifica uma
  // criação (create() — ainda não existe id próprio): qualquer usuário
  // encontrado com este CPF é necessariamente outra conta, já que
  // `usuarioComEsteCpf.id` (number) nunca é `=== null`.
  private async normalizarEValidarCpfParaUsuario(
    usuarioId: number | null,
    cpfInformado: string,
  ): Promise<string | null> {
    if (cpfInformado.trim() === '') {
      return null;
    }

    if (!cpfValido(cpfInformado)) {
      throw new BadRequestException('CPF inválido.');
    }

    const cpfNormalizado = normalizarCpf(cpfInformado);

    const usuarioComEsteCpf = await this.prisma.usuario.findUnique({
      where: { cpf: cpfNormalizado },
    });
    if (usuarioComEsteCpf && usuarioComEsteCpf.id !== usuarioId) {
      throw new ConflictException('Este CPF já está em uso por outra conta.');
    }

    return cpfNormalizado;
  }

  // Telefone vazio ("") limpa o campo. Sem checagem de duplicidade (nunca é
  // @unique — ver schema.prisma).
  private normalizarEValidarTelefone(telefoneInformado: string): string | null {
    if (telefoneInformado.trim() === '') {
      return null;
    }

    if (!telefoneValido(telefoneInformado)) {
      throw new BadRequestException('Telefone inválido.');
    }

    return normalizarTelefone(telefoneInformado);
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

  // Etapa 6.4 (Confirmação de e-mail) — grava o HASH (SHA-256, calculado em
  // AuthService) do token de verificação, nunca o token em texto puro,
  // mesmo raciocínio de criarRefreshToken. Usado tanto pelo primeiro envio
  // (AuthService.register) quanto pelo reenvio (AuthService.resendVerification)
  // — por isso também garante emailVerificado:false explicitamente aqui, em
  // vez de assumir que quem chamou já cuidou disso.
  async emitirTokenVerificacaoEmail(
    id: number,
    emailVerificationHash: string,
    emailVerificationExpiry: Date,
  ): Promise<void> {
    await this.prisma.usuario.update({
      where: { id },
      data: {
        emailVerificado: false,
        emailVerificationHash,
        emailVerificationExpiry,
      },
    });
  }

  async buscarPorHashVerificacaoEmail(emailVerificationHash: string): Promise<{
    id: number;
    nome: string;
    email: string;
    emailVerificado: boolean;
    emailVerificationExpiry: Date | null;
  } | null> {
    return this.prisma.usuario.findFirst({
      where: { emailVerificationHash },
      select: {
        id: true,
        nome: true,
        email: true,
        emailVerificado: true,
        emailVerificationExpiry: true,
      },
    });
  }

  // Confirmação atômica condicional: só marca emailVerificado se o hash
  // informado ainda for exatamente o que está gravado no momento da escrita
  // — mesmo padrão de revogarRefreshTokenSeAtivo (Task 27), usado aqui para
  // que duas confirmações concorrentes do mesmo link nunca dupliquem efeito
  // (a segunda encontra `count: 0` e a chamada trata isso como "já
  // confirmado" em vez de repetir a escrita). O hash é sempre limpo junto
  // (uso único): uma segunda tentativa com o mesmo token, depois deste
  // ponto, deixa de encontrar qualquer usuário por
  // buscarPorHashVerificacaoEmail — indistinguível de um token que nunca
  // existiu, por design (mesmo raciocínio de redefinirSenha/resetToken).
  async confirmarEmailSeHashValido(
    id: number,
    emailVerificationHash: string,
  ): Promise<number> {
    const resultado = await this.prisma.usuario.updateMany({
      where: { id, emailVerificationHash },
      data: {
        emailVerificado: true,
        emailVerificadoEm: new Date(),
        emailVerificationHash: null,
        emailVerificationExpiry: null,
      },
    });
    return resultado.count;
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
      emailVerificado: usuario.emailVerificado,
      cpf: usuario.cpf,
      telefone: usuario.telefone,
    };
  }
}
